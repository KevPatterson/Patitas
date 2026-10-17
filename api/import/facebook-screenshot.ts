import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { fail, internalError, json, requireAuth, rejectMethod } from '../_lib/http';
import { limitByIp, limitByUser } from '../_lib/rate-limit-utils';
import { detectImage, containsGpsMetadata, MAX_IMAGE_BYTES } from '../_lib/image-guard';
import { getAIProvider, type VisionResult } from '../_lib/ai-provider';

interface ScreenshotImportResponse {
  success: boolean;
  data?: {
    extracted: Record<string, unknown>;
    confidence: number;
    image_url: string;
  };
  error?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'facebook-import-ip', 20, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const userLimit = await limitByUser(res, 'facebook-import-user', auth.user.id, 15, 3600_000);
  if (!userLimit.ok) return;

  // Parsear FormData (multipart/form-data)
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return fail(res, 400, 'INVALID_INPUT', 'Se requiere multipart/form-data');
  }

  let formData: FormData;
  try {
    formData = req.body as unknown as FormData;
  } catch {
    return fail(res, 400, 'INVALID_INPUT', 'No se pudo leer el formulario');
  }

  const file = formData.get('image') as File | null;
  if (!file) {
    return fail(res, 400, 'INVALID_INPUT', 'Falta el archivo "image"');
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Validación por CONTENIDO (magic bytes), no por `file.type`: el MIME lo envía
  // el cliente y se puede falsificar (un .php renombrado a .jpg, o un SVG con
  // script). Se rechazan SVG y GIF explícitamente.
  const detected = detectImage(bytes, MAX_IMAGE_BYTES);

  if (!detected.ok) {
    return fail(res, 400, 'INVALID_INPUT', detected.reason);
  }

  // Comprobación redundante con la del endpoint de uploads: aquí entra un archivo
  // que puede venir de una captura con GPS.
  if (containsGpsMetadata(bytes)) {
    return fail(
      res,
      400,
      'INVALID_INPUT',
      'La captura contiene datos de geolocalización (EXIF GPS). Vuelve a guardarla sin ubicación.'
    );
  }

  // Nombre generado en servidor (uuid). Nunca se usa el nombre original del
  // cliente: evita path traversal y filtración de datos en el nombre.
  const extension = detected.mimeType === 'image/jpeg' ? 'jpg' : detected.mimeType.split('/')[1];
  const filename = `facebook-imports/${auth.user.id}/${crypto.randomUUID()}.${extension}`;

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('pet-images')
    .upload(filename, Buffer.from(bytes), {
      contentType: detected.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return internalError(res, 'facebook-screenshot/upload', uploadError);
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from('pet-images')
    .getPublicUrl(uploadData.path);

  const imageUrl = publicUrlData.publicUrl;
  const image = { bytes, mimeType: detected.mimeType, sourceUrl: imageUrl };

  // Procesar con OCR + Vision
  try {
    const provider = getAIProvider();

    // Se pasan los bytes ya validados; el proveedor no descarga la URL.
    const ocrResult = await provider.extractTextFromImage(image);

    const visionResult = await provider.analyzeImage(
      image,
      'Analiza esta captura de pantalla de Facebook sobre una mascota. ' +
        'Extrae: tipo de post (perdido/encontrado/adopción/abandonado), ' +
        'especie, raza, color, tamaño, sexo, collar, placa, ' +
        'ubicación (provincia/municipio/zona), fecha, teléfono, WhatsApp, email, recompensa. ' +
        'Responde en JSON con campos: type, species, breed, color, size, sex, collar, plate, ' +
        'province, municipality, zone, event_date, contact_phone, contact_whatsapp, contact_email, reward, description, confidence_by_field'
    );
    
    // Combinar resultados
    const combinedText = `${ocrResult.text}\n\n${visionResult.description ?? ''}`;
    
    // Extraer datos estructurados del texto combinado
    const extracted = extractStructuredDataFromText(combinedText, visionResult);
    
    // Calcular confidence promedio
    const confidences = Object.values(extracted.confidence).filter(v => v > 0);
    const avgConfidence = confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
      : 0.3;
    
    return json(res, 200, {
      success: true,
      data: {
        extracted,
        confidence: Math.round(avgConfidence * 100) / 100,
        image_url: imageUrl,
      },
    } as ScreenshotImportResponse);
    
  } catch (error) {
    return internalError(res, 'facebook-screenshot/ai', error);
  }
}

function extractStructuredDataFromText(text: string, visionResult: VisionResult): {
  type?: 'LOST' | 'FOUND' | 'ADOPTION' | 'ABANDONED';
  species?: string;
  breed?: string;
  color?: string;
  size?: 'PEQUENO' | 'MEDIANO' | 'GRANDE';
  sex?: 'MACHO' | 'HEMBRA';
  collar?: boolean;
  plate?: boolean;
  province?: string;
  municipality?: string;
  zone?: string;
  event_date?: string;
  contact_phone?: string;
  contact_whatsapp?: string;
  contact_email?: string;
  reward?: string;
  description?: string;
  confidence: Record<string, number>;
} {
  const lowerText = text.toLowerCase();
  const result: {
    type?: 'LOST' | 'FOUND' | 'ADOPTION' | 'ABANDONED';
    species?: string;
    breed?: string;
    color?: string;
    size?: 'PEQUENO' | 'MEDIANO' | 'GRANDE';
    sex?: 'MACHO' | 'HEMBRA';
    collar?: boolean;
    plate?: boolean;
    province?: string;
    municipality?: string;
    zone?: string;
    event_date?: string;
    contact_phone?: string;
    contact_whatsapp?: string;
    contact_email?: string;
    reward?: string;
    description?: string;
    confidence: Record<string, number>;
  } = { confidence: {} };
  
  // Detectar tipo
  let type: 'LOST' | 'FOUND' | 'ADOPTION' | 'ABANDONED' | undefined;
  let typeConfidence = 0;
  
  if (lowerText.includes('perdido') || lowerText.includes('se perdió') || lowerText.includes('busco a mi') || lowerText.includes('lost')) {
    type = 'LOST'; typeConfidence = 0.8;
  } else if (lowerText.includes('encontrado') || lowerText.includes('encontré') || lowerText.includes('hallado') || lowerText.includes('found')) {
    type = 'FOUND'; typeConfidence = 0.8;
  } else if (lowerText.includes('adopción') || lowerText.includes('adoptar') || lowerText.includes('busca hogar') || lowerText.includes('adoption')) {
    type = 'ADOPTION'; typeConfidence = 0.8;
  } else if (lowerText.includes('abandonado') || lowerText.includes('abandono')) {
    type = 'ABANDONED'; typeConfidence = 0.8;
  }
  
  if (type) result.type = type;
  result.confidence.type = typeConfidence;
  
  // Extraer especies de vision labels
  const speciesLabels = visionResult.labels.filter(l => 
    ['dog', 'cat', 'perro', 'gato', 'puppy', 'kitten'].some(kw => l.label.toLowerCase().includes(kw))
  );
  if (speciesLabels.length > 0) {
    const top = speciesLabels[0];
    result.species = top.label.includes('dog') || top.label.includes('perro') || top.label.includes('puppy') ? 'Perro' : 'Gato';
    result.confidence.species = top.confidence;
  }
  
  // Extraer raza de vision
  const breedLabels = visionResult.labels.filter(l => 
    l.confidence > 0.5 && !['dog', 'cat', 'perro', 'gato', 'puppy', 'kitten', 'animal', 'pet'].includes(l.label.toLowerCase())
  );
  if (breedLabels.length > 0) {
    result.breed = breedLabels[0].label;
    result.confidence.breed = breedLabels[0].confidence;
  }
  
  // Color
  const colorKeywords = ['marrón', 'brown', 'negro', 'black', 'blanco', 'white', 'gris', 'gray', 'dorado', 'golden', 'atigrado', 'tabby'];
  for (const kw of colorKeywords) {
    if (lowerText.includes(kw)) {
      result.color = kw.charAt(0).toUpperCase() + kw.slice(1);
      result.confidence.color = 0.7;
      break;
    }
  }
  
  // Tamaño
  if (lowerText.includes('pequeñ') || lowerText.includes('small') || lowerText.includes('cachorro')) {
    result.size = 'PEQUENO'; result.confidence.size = 0.6;
  } else if (lowerText.includes('grande') || lowerText.includes('large') || lowerText.includes('giant')) {
    result.size = 'GRANDE'; result.confidence.size = 0.6;
  } else if (lowerText.includes('mediano') || lowerText.includes('medium')) {
    result.size = 'MEDIANO'; result.confidence.size = 0.6;
  }
  
  // Sexo
  if (lowerText.includes('macho') || lowerText.includes('male') || lowerText.includes('él') || 
      (lowerText.includes('perro') && !lowerText.includes('perra'))) {
    result.sex = 'MACHO'; result.confidence.sex = 0.5;
  } else if (lowerText.includes('hembra') || lowerText.includes('female') || lowerText.includes('ella') || 
             lowerText.includes('perra') || lowerText.includes('gata')) {
    result.sex = 'HEMBRA'; result.confidence.sex = 0.5;
  }
  
  // Collar/placa
  result.collar = lowerText.includes('collar') || lowerText.includes('collared');
  result.confidence.collar = result.collar ? 0.7 : 0.3;
  
  result.plate = lowerText.includes('placa') || lowerText.includes('tag') || lowerText.includes('identificación');
  result.confidence.plate = result.plate ? 0.7 : 0.3;
  
  // Teléfonos (Cuba: 8 dígitos, empieza por 5)
  const phoneMatches = text.match(/\b(5\d{7})\b/g);
  if (phoneMatches && phoneMatches.length > 0) {
    result.contact_phone = phoneMatches[0];
    result.confidence.contact_phone = 0.9;
  }
  
  // WhatsApp (wa.me o whatsapp)
  const waMatch = text.match(/(?:wa\.me\/|whatsapp\.com\/)([\d+]+)/i) || 
                  text.match(/whatsapp[:\s]+(\+?53?\s?5\d{7})/i);
  if (waMatch) {
    result.contact_whatsapp = waMatch[1].replace(/\s/g, '');
    result.confidence.contact_whatsapp = 0.8;
  }
  
  // Email
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    result.contact_email = emailMatch[0];
    result.confidence.contact_email = 0.9;
  }
  
  // Provincia (Cuba)
  const provinces = [
    'Pinar del Río', 'Artemisa', 'La Habana', 'Mayabeque', 'Matanzas',
    'Villa Clara', 'Cienfuegos', 'Sancti Spíritus', 'Ciego de Ávila',
    'Camagüey', 'Las Tunas', 'Holguín', 'Granma', 'Santiago de Cuba',
    'Guantánamo', 'Isla de la Juventud'
  ];
  for (const prov of provinces) {
    if (lowerText.includes(prov.toLowerCase())) {
      result.province = prov;
      result.confidence.province = 0.8;
      break;
    }
  }
  
  // Fecha (patrones comunes)
  const dateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    result.event_date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    result.confidence.event_date = 0.7;
  }
  
  // Recompensa
  const rewardMatch = text.match(/(?:recompensa|reward)[:\s]*([\d$.,]+)/i);
  if (rewardMatch) {
    result.reward = rewardMatch[1];
    result.confidence.reward = 0.6;
  }
  
  // Descripción general
  result.description = text.slice(0, 2000);
  result.confidence.description = 0.5;
  
  return result;
}