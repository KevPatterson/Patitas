import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from '../_lib/rate-limit-utils';
import { getAIProvider } from '../_lib/ai-provider';

/**
 * Endpoint para extraer información de una imagen
 * POST /api/ai/extract-from-image
 * 
 * Body: {
 *   imageUrl: string; // URL pública de la imagen
 * }
 * 
 * Retorna atributos extraídos de la imagen (especie, raza, color, texto OCR, etc.)
 * Para autocompletar el formulario de publicación
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 30 extracciones por hora
  if (!checkRateLimit(req, res, 'ai-extract-image', 30, 3600_000)) {
    return;
  }

  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);

  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Unauthorized' });
  }

  let payload: { imageUrl?: string } = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!payload.imageUrl) {
    return res.status(400).json({ error: 'Missing imageUrl' });
  }

  try {
    const provider = getAIProvider();

    // Ejecutar OCR y Vision en paralelo
    const [ocrResult, visionResult] = await Promise.all([
      provider.extractTextFromImage(payload.imageUrl).catch(() => null),
      provider.analyzeImage(payload.imageUrl, 
        'Analyze this image related to a pet (lost, found, or adoption). Extract: species (dog/cat/other), breed, color, size (small/medium/large), sex if visible, distinctive features (collar, tags, marks), and any visible text like phone numbers, locations, dates. Respond in JSON format.'
      ).catch(() => null),
    ]);

    // Procesar OCR para extraer información estructurada
    const extractedFromOCR = ocrResult ? extractStructuredDataFromText(ocrResult.text) : {};

    // Procesar Vision para extraer atributos visuales
    const extractedFromVision = visionResult ? extractAttributesFromVision(visionResult) : {};

    // Combinar resultados
    const combined = {
      // Datos visuales (prioridad a vision)
      species: extractedFromVision.species || extractedFromOCR.species || null,
      breed: extractedFromVision.breed || extractedFromOCR.breed || null,
      color: extractedFromVision.color || extractedFromOCR.color || null,
      size: extractedFromVision.size || extractedFromOCR.size || null,
      sex: extractedFromVision.sex || extractedFromOCR.sex || null,
      age: extractedFromVision.age || extractedFromOCR.age || null,
      collar: extractedFromVision.collar || false,
      plate: extractedFromVision.plate || false,
      characteristics: extractedFromVision.characteristics || null,

      // Datos de OCR (solo de texto)
      phone: extractedFromOCR.phone || null,
      whatsapp: extractedFromOCR.whatsapp || null,
      location: extractedFromOCR.location || null,
      province: extractedFromOCR.province || null,
      municipality: extractedFromOCR.municipality || null,
      date: extractedFromOCR.date || null,
      time: extractedFromOCR.time || null,
      reward: extractedFromOCR.reward || null,
      petName: extractedFromOCR.petName || null,

      // Metadata
      ocrText: ocrResult?.text || null,
      visionDescription: visionResult?.description || null,
      confidence: {
        ocr: ocrResult?.confidence || 0,
        vision: visionResult ? 0.85 : 0,
      },
    };

    return res.status(200).json({
      ok: true,
      extracted: combined,
    });
  } catch (error) {
    console.error('Error extracting from image:', error);
    return res.status(500).json({
      error: 'Failed to extract information from image',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Extraer datos estructurados del texto OCR
 */
function extractStructuredDataFromText(text: string): {
  species?: string;
  breed?: string;
  color?: string;
  size?: string;
  sex?: string;
  age?: string;
  phone?: string;
  whatsapp?: string;
  location?: string;
  province?: string;
  municipality?: string;
  date?: string;
  time?: string;
  reward?: string;
  petName?: string;
} {
  const result: Record<string, string> = {};
  const lowerText = text.toLowerCase();

  // Detectar especie
  if (lowerText.includes('perro') || lowerText.includes('dog')) {
    result.species = 'DOG';
  } else if (lowerText.includes('gato') || lowerText.includes('cat')) {
    result.species = 'CAT';
  }

  // Detectar tamaño
  if (lowerText.includes('pequeño') || lowerText.includes('small')) {
    result.size = 'SMALL';
  } else if (lowerText.includes('mediano') || lowerText.includes('medium')) {
    result.size = 'MEDIUM';
  } else if (lowerText.includes('grande') || lowerText.includes('large')) {
    result.size = 'LARGE';
  }

  // Detectar sexo
  if (lowerText.includes('macho') || lowerText.includes('male')) {
    result.sex = 'MALE';
  } else if (lowerText.includes('hembra') || lowerText.includes('female')) {
    result.sex = 'FEMALE';
  }

  // Detectar color
  const colors = ['negro', 'black', 'blanco', 'white', 'marrón', 'brown', 'dorado', 'golden', 'gris', 'gray'];
  for (const color of colors) {
    if (lowerText.includes(color)) {
      result.color = color;
      break;
    }
  }

  // Extraer teléfono (formato cubano: 5xxxxxxx o +53xxxxxxxx)
  const phoneRegex = /(?:\+?53\s?)?([5]\d{7})/g;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/\s/g, '');
    result.whatsapp = result.phone; // Asumir que es WhatsApp también
  }

  // Extraer recompensa
  const rewardRegex = /(?:recompensa|reward)[\s:]*(?:\$|CUP|USD)?(\d+)/i;
  const rewardMatch = text.match(rewardRegex);
  if (rewardMatch) {
    result.reward = `$${rewardMatch[1]}`;
  }

  // Extraer fecha (formatos: DD/MM/YYYY, DD-MM-YYYY, DD de mes)
  const dateRegex = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})|(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    result.date = dateMatch[0];
  }

  // Extraer hora
  const timeRegex = /(\d{1,2}):(\d{2})\s?(am|pm|AM|PM)?/;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    result.time = timeMatch[0];
  }

  // Detectar provincias cubanas
  const provinces = ['pinar del río', 'artemisa', 'la habana', 'mayabeque', 'matanzas', 'cienfuegos', 'villa clara', 'sancti spíritus', 'ciego de ávila', 'camagüey', 'las tunas', 'holguín', 'granma', 'santiago de cuba', 'guantánamo', 'isla de la juventud'];
  for (const province of provinces) {
    if (lowerText.includes(province)) {
      // Capitalizar
      result.province = province.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  return result;
}

/**
 * Extraer atributos de los resultados de Vision
 */
function extractAttributesFromVision(visionResult: {
  labels: Array<{ label: string; confidence: number }>;
  description?: string;
}): {
  species?: string;
  breed?: string;
  color?: string;
  size?: string;
  sex?: string;
  age?: string;
  collar?: boolean;
  plate?: boolean;
  characteristics?: string;
} {
  const result: Record<string, string | boolean> = {};
  const labels = visionResult.labels.map(l => l.label.toLowerCase());
  const description = (visionResult.description || '').toLowerCase();

  // Detectar especie
  if (labels.includes('dog') || labels.includes('perro') || description.includes('dog') || description.includes('perro')) {
    result.species = 'DOG';
  } else if (labels.includes('cat') || labels.includes('gato') || description.includes('cat') || description.includes('gato')) {
    result.species = 'CAT';
  }

  // Detectar características visuales
  if (labels.includes('collar') || description.includes('collar')) {
    result.collar = true;
  }

  if (labels.includes('tag') || labels.includes('plate') || description.includes('tag') || description.includes('plate')) {
    result.plate = true;
  }

  // Detectar color
  const colorMap: Record<string, string> = {
    'brown': 'Marrón',
    'black': 'Negro',
    'white': 'Blanco',
    'golden': 'Dorado',
    'gray': 'Gris',
    'grey': 'Gris',
  };

  for (const [englishColor, spanishColor] of Object.entries(colorMap)) {
    if (labels.includes(englishColor) || description.includes(englishColor)) {
      result.color = spanishColor;
      break;
    }
  }

  // Detectar tamaño
  if (labels.includes('small') || description.includes('small')) {
    result.size = 'SMALL';
  } else if (labels.includes('large') || description.includes('large')) {
    result.size = 'LARGE';
  } else {
    result.size = 'MEDIUM'; // Default
  }

  // Extraer características descriptivas
  if (visionResult.description) {
    const features = [];
    
    if (description.includes('collar')) features.push('usa collar');
    if (description.includes('friendly')) features.push('aspecto amigable');
    if (description.includes('outdoor')) features.push('fotografiado al aire libre');
    
    if (features.length > 0) {
      result.characteristics = features.join(', ');
    }
  }

  return result as {
    species?: string;
    breed?: string;
    color?: string;
    size?: string;
    sex?: string;
    age?: string;
    collar?: boolean;
    plate?: boolean;
    characteristics?: string;
  };
}
