import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from '../_lib/rate-limit-utils';
import { getAIProvider, type VisionResult } from '../_lib/ai-provider';

function json(res: VercelResponse, statusCode: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).json(body);
}

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
  
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  
  // Rate limiting: 15 imports por hora por usuario
  if (!checkRateLimit(req, res, 'facebook-import-screenshot', 15, 3600_000)) {
    return;
  }
  
  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);
  
  if (authError || !user) {
    return json(res, 401, { error: authError || 'Unauthorized' });
  }
  
  // Parsear FormData (multipart/form-data)
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return json(res, 400, { error: 'Se requiere multipart/form-data' });
  }
  
  // En Vercel, el body ya viene parseado para FormData
  let formData: FormData;
  try {
    formData = req.body as unknown as FormData;
  } catch {
    return json(res, 400, { error: 'Error parseando FormData' });
  }
  
  const file = formData.get('image') as File | null;
  if (!file) {
    return json(res, 400, { error: 'Archivo image requerido' });
  }
  
  // Validar archivo
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return json(res, 400, { error: 'Tipo de archivo no permitido. Usa JPG, PNG o WebP' });
  }
  
  const maxSize = 8 * 1024 * 1024; // 8MB
  if (file.size > maxSize) {
    return json(res, 400, { error: 'Archivo demasiado grande (máx 8MB)' });
  }
  
  // Subir a Storage usando supabaseAdmin
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const filename = `facebook-imports/${user.id}/${Date.now()}.${ext}`;
  
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('pet-images')
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: true,
    });
  
  if (uploadError) {
    console.error('Error subiendo imagen:', uploadError);
    return json(res, 500, { error: 'Error subiendo imagen' });
  }
  
  // Obtener URL pública
  const { data: publicUrlData } = supabaseAdmin.storage
    .from('pet-images')
    .getPublicUrl(uploadData.path);
  const imageUrl = publicUrlData.publicUrl;
  
  // Procesar con OCR + Vision (reutilizar lógica existente)
  try {
    const provider = getAIProvider();
    
    // OCR
    const ocrResult = await provider.extractTextFromImage(imageUrl);
    
    // Vision
    const visionResult = await provider.analyzeImage(imageUrl,
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
    console.error('Error procesando captura:', error);
    return json(res, 500, { error: 'Error procesando imagen con IA' });
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