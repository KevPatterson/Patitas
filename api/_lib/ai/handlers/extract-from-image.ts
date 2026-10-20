import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../../../types/vercel.js';
import { supabaseAdmin } from '../../supabase-admin.js';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../../http.js';
import { limitAiByUser, limitByIp } from '../../rate-limit-utils.js';
import { fetchRemoteImage } from '../../url-guard.js';
import { toImagePayload } from '../../image-guard.js';
import { aiProviderIsReal, AI_ENABLED, providerAvailable } from '../../env.js';
import { getAIProvider } from '../../ai-provider.js';

/**
 * POST /api/ai?action=extract-from-image — OCR + Computer Vision para autocompletar el
 * formulario de publicación.
 *
 * Hallazgo API-05 (SSRF): antes se aceptaba `imageUrl` tal cual y el proveedor
 * hacía `fetch(imageUrl)`. Permitía alcanzar `http://169.254.169.254/` (metadatos
 * de nube) y servicios internos. Ahora:
 *
 *   1. `fetchRemoteImage` valida esquema, resuelve DNS, bloquea IPs privadas,
 *      no sigue redirecciones y aplica timeout y tamaño máximo.
 *   2. `toImagePayload` verifica los magic bytes (JPEG/PNG/WebP) y rechaza SVG.
 *   3. Al proveedor solo le llegan bytes, nunca una URL.
 *
 * Además: cuota por usuario (no solo por IP) y errores sin filtrar detalles.
 */

const extractSchema = z.object({
  imageUrl: z.string().url('La URL de la imagen no es válida').max(2048),
});

export async function handleExtractFromImage(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'ai-extract-ip', 60, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  // Cuota por usuario, compartida con el resto de la IA (no se puede rotar).
  const userLimit = await limitAiByUser(res, auth.user.id, true);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, extractSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  if (!AI_ENABLED) {
    return fail(res, 503, 'INTERNAL', 'El análisis de imágenes por IA está desactivado temporalmente.');
  }

  const providerStatus = providerAvailable();

  if (!providerStatus.ok) {
    return fail(res, 503, 'INTERNAL', providerStatus.reason);
  }

  const download = await fetchRemoteImage(parsed.data.imageUrl, { maxBytes: 8 * 1024 * 1024 });

  if (!download.ok) {
    return fail(res, 400, 'INVALID_INPUT', download.reason);
  }

  const payload = toImagePayload(new Uint8Array(download.bytes), parsed.data.imageUrl);

  if (!payload.ok) {
    return fail(res, 400, 'INVALID_INPUT', payload.reason);
  }

  try {
    const provider = getAIProvider();

    // OCR y Vision en paralelo. Los fallos individuales no tumban la respuesta.
    const [ocrResult, visionResult] = await Promise.all([
      provider.extractTextFromImage(payload.image).catch(() => null),
      provider
        .analyzeImage(
          payload.image,
          'Analyze this image related to a pet (lost, found, or adoption). Extract: species (dog/cat/other), breed, color, size (small/medium/large), sex if visible, distinctive features (collar, tags, marks), and any visible text like phone numbers, locations, dates. Respond in JSON format.'
        )
        .catch(() => null),
    ]);

    const extractedFromOCR = ocrResult ? extractStructuredDataFromText(ocrResult.text) : {};
    const extractedFromVision = visionResult ? extractAttributesFromVision(visionResult) : {};

    const combined = {
      species: extractedFromVision.species || extractedFromOCR.species || null,
      breed: extractedFromVision.breed || extractedFromOCR.breed || null,
      color: extractedFromVision.color || extractedFromOCR.color || null,
      size: extractedFromVision.size || extractedFromOCR.size || null,
      sex: extractedFromVision.sex || extractedFromOCR.sex || null,
      age: extractedFromVision.age || extractedFromOCR.age || null,
      collar: extractedFromVision.collar || false,
      plate: extractedFromVision.plate || false,
      characteristics: extractedFromVision.characteristics || null,

      phone: extractedFromOCR.phone || null,
      whatsapp: extractedFromOCR.whatsapp || null,
      location: extractedFromOCR.location || null,
      province: extractedFromOCR.province || null,
      municipality: extractedFromOCR.municipality || null,
      date: extractedFromOCR.date || null,
      time: extractedFromOCR.time || null,
      reward: extractedFromOCR.reward || null,
      petName: extractedFromOCR.petName || null,

      ocrText: ocrResult?.text || null,
      visionDescription: visionResult?.description || null,
      confidence: {
        ocr: ocrResult?.confidence || 0,
        vision: visionResult ? 0.85 : 0,
      },
    };

    return json(res, 200, {
      ok: true,
      extracted: combined,
      // La UI debe poder avisar de que esto es una demostración, no IA real.
      provider_is_real: aiProviderIsReal(),
      disclaimer: aiProviderIsReal()
        ? null
        : 'Resultados de demostración: el proveedor de IA configurado no es real.',
    });
  } catch (error) {
    return internalError(res, 'ai/extract-from-image', error);
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

  if (lowerText.includes('perro') || lowerText.includes('dog')) {
    result.species = 'DOG';
  } else if (lowerText.includes('gato') || lowerText.includes('cat')) {
    result.species = 'CAT';
  }

  if (lowerText.includes('pequeño') || lowerText.includes('small')) {
    result.size = 'SMALL';
  } else if (lowerText.includes('mediano') || lowerText.includes('medium')) {
    result.size = 'MEDIUM';
  } else if (lowerText.includes('grande') || lowerText.includes('large')) {
    result.size = 'LARGE';
  }

  if (lowerText.includes('macho') || lowerText.includes('male')) {
    result.sex = 'MALE';
  } else if (lowerText.includes('hembra') || lowerText.includes('female')) {
    result.sex = 'FEMALE';
  }

  const colors = ['negro', 'black', 'blanco', 'white', 'marrón', 'brown', 'dorado', 'golden', 'gris', 'gray'];
  for (const color of colors) {
    if (lowerText.includes(color)) {
      result.color = color;
      break;
    }
  }

  // Teléfono cubano: 5xxxxxxx o +53xxxxxxxx
  const phoneRegex = /(?:\+?53\s?)?([5]\d{7})/g;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/\s/g, '');
    result.whatsapp = result.phone;
  }

  const rewardRegex = /(?:recompensa|reward)[\s:]*(?:\$|CUP|USD)?(\d+)/i;
  const rewardMatch = text.match(rewardRegex);
  if (rewardMatch) {
    result.reward = `$${rewardMatch[1]}`;
  }

  const dateRegex = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})|(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    result.date = dateMatch[0];
  }

  const timeRegex = /(\d{1,2}):(\d{2})\s?(am|pm|AM|PM)?/;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    result.time = timeMatch[0];
  }

  const provinces = ['pinar del río', 'artemisa', 'la habana', 'mayabeque', 'matanzas', 'cienfuegos', 'villa clara', 'sancti spíritus', 'ciego de ávila', 'camagüey', 'las tunas', 'holguín', 'granma', 'santiago de cuba', 'guantánamo', 'isla de la juventud'];
  for (const province of provinces) {
    if (lowerText.includes(province)) {
      result.province = province.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
  const labels = visionResult.labels.map((l) => l.label.toLowerCase());
  const description = (visionResult.description || '').toLowerCase();

  if (labels.includes('dog') || labels.includes('perro') || description.includes('dog') || description.includes('perro')) {
    result.species = 'DOG';
  } else if (labels.includes('cat') || labels.includes('gato') || description.includes('cat') || description.includes('gato')) {
    result.species = 'CAT';
  }

  if (labels.includes('collar') || description.includes('collar')) {
    result.collar = true;
  }

  if (labels.includes('tag') || labels.includes('plate') || description.includes('tag') || description.includes('plate')) {
    result.plate = true;
  }

  const colorMap: Record<string, string> = {
    brown: 'Marrón',
    black: 'Negro',
    white: 'Blanco',
    golden: 'Dorado',
    gray: 'Gris',
    grey: 'Gris',
  };

  for (const [englishColor, spanishColor] of Object.entries(colorMap)) {
    if (labels.includes(englishColor) || description.includes(englishColor)) {
      result.color = spanishColor;
      break;
    }
  }

  if (labels.includes('small') || description.includes('small')) {
    result.size = 'SMALL';
  } else if (labels.includes('large') || description.includes('large')) {
    result.size = 'LARGE';
  } else {
    result.size = 'MEDIUM';
  }

  if (visionResult.description) {
    const features: string[] = [];

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