import type { VercelRequest, VercelResponse } from '../types/vercel.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../_lib/http.js';
import { limitByIp, limitByUser } from '../_lib/rate-limit-utils.js';
import { assertSafeRemoteUrl, fetchRemoteImage } from '../_lib/url-guard.js';
import { toImagePayload } from '../_lib/image-guard.js';
import { aiProviderIsReal, AI_ENABLED } from '../_lib/env.js';
import {
  facebookLinkImportSchema,
  extractOpenGraphMetadata,
  FACEBOOK_IMPORT_CONSTANTS,
} from '../../src/lib/validations/facebook-import.js';
import { getAIProvider } from '../_lib/ai-provider.js';
import { buildFormExtraction } from '../_lib/ai/form-extraction.js';

/**
 * POST /api/import/facebook-link — importa metadatos Open Graph de un enlace.
 *
 * Ya tenía dos buenas defensas: `redirect: 'manual'` y límite de tamaño de la
 * respuesta. Faltaban dos agujeros del hallazgo API-05:
 *
 *   1. La URL que envía el usuario se validaba solo con la allowlist de dominios
 *      de Facebook (en `facebookLinkImportSchema`), sin resolver DNS: un dominio
 *      permitido que resuelva a una IP privada (o un registro DNS malicioso)
 *      pasaba.
 *   2. El `og:image` extraído del HTML remoto se mandaba al proveedor de IA tal
 *      cual, así que **el HTML de un tercero** elegía la URL que el servidor
 *      descargaba. Ese era el vector más grave.
 *
 * Ahora la URL de entrada y la de `og:image` pasan por el mismo guard, y al
 * proveedor solo le llegan bytes verificados.
 */

type FacebookImportResponse = {
  success: boolean;
  data?: {
    title: string | null;
    description: string | null;
    image_url: string | null;
    extracted?: Record<string, unknown>;
    confidence?: number;
    provider_is_real?: boolean;
  };
  error?: string;
  suggestion?: 'UPLOAD_SCREENSHOT';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'facebook-import-ip', 20, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const userLimit = await limitByUser(res, 'facebook-import-user', auth.user.id, 10, 3600_000);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, facebookLinkImportSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const url = parsed.data.url;

  // Guard completo antes de descargar nada: esquema, resolución DNS y bloqueo de
  // rangos privados. La allowlist de dominios de Facebook ya la aplicó el schema.
  const safeUrl = await assertSafeRemoteUrl(url);

  if (!safeUrl.ok) {
    return fail(res, 400, 'INVALID_INPUT', safeUrl.reason, { suggestion: 'UPLOAD_SCREENSHOT' });
  }

  let html: string;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FACEBOOK_IMPORT_CONSTANTS.REQUEST_TIMEOUT_MS);

    const response = await fetch(safeUrl.url, {
      method: 'GET',
      headers: {
        'User-Agent': FACEBOOK_IMPORT_CONSTANTS.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      redirect: 'manual', // No seguir redirecciones
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status >= 300 && response.status < 400) {
      return json(res, 400, {
        success: false,
        error: 'Redirección detectada. Por seguridad no seguimos redirecciones. Intenta con la URL final o sube una captura.',
        suggestion: 'UPLOAD_SCREENSHOT',
      } satisfies FacebookImportResponse);
    }

    if (!response.ok) {
      return json(res, 400, {
        success: false,
        error: `No se pudo acceder al enlace (${response.status}). Facebook puede requerir login.`,
        suggestion: 'UPLOAD_SCREENSHOT',
      } satisfies FacebookImportResponse);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return json(res, 400, {
        success: false,
        error: 'La URL no devuelve HTML. Puede ser un enlace directo a imagen/video.',
        suggestion: 'UPLOAD_SCREENSHOT',
      } satisfies FacebookImportResponse);
    }

    // Leer con límite de tamaño
    const reader = response.body?.getReader();
    if (!reader) {
      return fail(res, 502, 'INTERNAL', 'No se pudo leer la respuesta remota');
    }

    let receivedSize = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedSize += value.length;

      if (receivedSize > FACEBOOK_IMPORT_CONSTANTS.MAX_RESPONSE_SIZE) {
        void reader.cancel('Response too large');
        return fail(res, 400, 'INVALID_INPUT', 'La página remota es demasiado grande');
      }
    }

    html = Buffer.concat(chunks).toString('utf-8');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return fail(res, 408, 'INTERNAL', 'El enlace tardó demasiado en responder');
    }
    return internalError(res, 'facebook-link/fetch', error);
  }

  const metadata = extractOpenGraphMetadata(html);
  const hasUsefulData = metadata.title || metadata.description || metadata.image;

  if (!hasUsefulData) {
    return json(res, 200, {
      success: false,
      error: 'No se pudieron extraer datos públicos del enlace. Facebook puede requerir login o el post no tiene metadatos abiertos.',
      suggestion: 'UPLOAD_SCREENSHOT',
    } satisfies FacebookImportResponse);
  }

  // Imagen de Open Graph: es contenido controlado por un tercero, así que pasa
  // por el mismo guard y por la verificación de magic bytes.
  let visionInput: { labels: Array<{ label: string; confidence: number }>; description?: string } | null =
    null;

  if (metadata.image && AI_ENABLED) {
    try {
      const download = await fetchRemoteImage(metadata.image, { maxBytes: 8 * 1024 * 1024 });

      if (download.ok) {
        const payload = toImagePayload(new Uint8Array(download.bytes), metadata.image);

        if (payload.ok) {
          const provider = getAIProvider();
          const visionResult = await provider.analyzeImage(
            payload.image,
            'Analiza esta imagen de una mascota. ' +
              'Devuelve SOLO un JSON válido con: type (LOST/FOUND/ADOPTION/ABANDONED/SIGHTING), ' +
              'species (dog/cat/bird/rabbit/rodent/reptile/other), breed, color, ' +
              'size (small/medium/large), sex (male/female), age (puppy/young/adult/senior), ' +
              'collar (true/false), plate (true/false), characteristics, ' +
              'province y municipality (nombres exactos de Cuba), zone, address. ' +
              'Si un dato no se ve, usa null.'
          );

          visionInput = {
            labels: visionResult.labels,
            description: visionResult.description,
          };
        }
      }
    } catch (error) {
      console.warn('[facebook-link] visión no disponible para el og:image', error);
    }
  }

  // Los metadatos Open Graph hacen de OCR: el texto del post suele traer la
  // ubicación, el teléfono y la fecha. La visión aporta lo físico (especie,
  // color). `buildFormExtraction` unifica ambos y resuelve las coordenadas.
  const ogText = [metadata.title, metadata.description].filter(Boolean).join('\n');
  const extracted = buildFormExtraction({
    ocr: ogText ? { text: ogText, confidence: 0.6 } : null,
    vision: visionInput,
  });

  return json(res, 200, {
    success: true,
    data: {
      title: metadata.title,
      description: metadata.description,
      image_url: metadata.image,
      extracted,
      confidence: extracted.confidence,
      provider_is_real: aiProviderIsReal(),
    },
  } satisfies FacebookImportResponse);
}
