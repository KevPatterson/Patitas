import type { VercelRequest, VercelResponse } from '../../_types/vercel.js';
import { supabaseAdmin } from '../supabase-admin.js';
import { fail, internalError, json, requireAuth, rejectMethod } from '../http.js';
import { limitByIp, limitByUser } from '../rate-limit-utils.js';
import { sanitizeImage } from '../image-process.js';
import { getAIProvider } from '../ai-provider.js';
import { buildFormExtraction } from '../ai/form-extraction.js';

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

  // Saneado completo: tipo real por magic bytes, rechazo de EXIF con GPS y
  // reencodeo a WebP SIN metadatos. Antes esta vía subía el archivo ORIGINAL al
  // bucket público: el EXIF/IPTC/XMP (modelo de cámara, fecha, miniatura) viajaba
  // intacto y filtraba información del remitente. Es la misma regla que aplica
  // /api/uploads desde la Fase 3; ante una captura había quedado sin cubrir.
  const sanitized = await sanitizeImage(bytes, 'publication');

  if (!sanitized.ok) {
    // GPS y formato inválido son errores del usuario (400); el resto, 422/500.
    const status = sanitized.code === 'PROCESSING_FAILED' ? 422 : 400;
    return fail(res, status, 'INVALID_INPUT', sanitized.reason, { code_detail: sanitized.code });
  }

  // Nombre generado en servidor (uuid). Nunca se usa el nombre original del
  // cliente: evita path traversal y filtración de datos en el nombre.
  const filename = `facebook-imports/${auth.user.id}/${crypto.randomUUID()}.webp`;

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('pet-images')
    .upload(filename, sanitized.bytes, {
      contentType: sanitized.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return internalError(res, 'facebook-screenshot/upload', uploadError);
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from('pet-images')
    .getPublicUrl(uploadData.path);

  const imageUrl = publicUrlData.publicUrl;
  const image = { bytes: sanitized.bytes, mimeType: sanitized.mimeType, sourceUrl: imageUrl };

  // Procesar con OCR + Vision. Se usa el mismo extractor que el autocompletado
  // del formulario para que ambos caminos devuelvan los mismos enums
  // (`small`, `male`, `dog`) y las coordenadas del municipio.
  try {
    const provider = getAIProvider();

    // Se pasan los bytes ya validados; el proveedor no descarga la URL.
    const ocrResult = await provider.extractTextFromImage(image);

    const visionResult = await provider.analyzeImage(
      image,
      'Analiza esta captura de pantalla de Facebook sobre una mascota. ' +
        'Devuelve SOLO un JSON válido con: ' +
        'type (LOST/FOUND/ADOPTION/ABANDONED/SIGHTING), ' +
        'species (dog/cat/bird/rabbit/rodent/reptile/other), breed, color, ' +
        'size (small/medium/large), sex (male/female), age (puppy/young/adult/senior), ' +
        'collar (true/false), plate (true/false), characteristics, pet_name, ' +
        'title (máximo 70 caracteres), description, ' +
        'province (provincia exacta de Cuba), municipality (municipio exacto), ' +
        'zone (reparto o referencia), address (calle y número), ' +
        'event_date (YYYY-MM-DD), event_time (HH:MM), reward, ' +
        'contact_phone, contact_whatsapp, contact_email. ' +
        'Transcribe lo que aparece en la captura. Si un dato no se ve, usa null.'
    );

    const extracted = buildFormExtraction({
      ocr: { text: ocrResult.text, confidence: ocrResult.confidence },
      vision: { labels: visionResult.labels, description: visionResult.description },
    });

    return json(res, 200, {
      success: true,
      data: {
        extracted,
        confidence: extracted.confidence,
        image_url: imageUrl,
      },
    } satisfies ScreenshotImportResponse);
  } catch (error) {
    return internalError(res, 'facebook-screenshot/ai', error);
  }
}

