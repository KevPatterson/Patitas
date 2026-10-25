import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../../../types/vercel.js';
import { supabaseAdmin } from '../../supabase-admin.js';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../../http.js';
import { limitAiByUser, limitByIp } from '../../rate-limit-utils.js';
import { fetchRemoteImage } from '../../url-guard.js';
import { MAX_IMAGE_BYTES, toImagePayload } from '../../image-guard.js';
import { aiProviderIsReal, AI_ENABLED, AI_PROVIDER, providerAvailable } from '../../env.js';
import { AIProviderError, getAIProvider } from '../../ai-provider.js';
import { buildFormExtraction } from '../form-extraction.js';

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
 * El formulario sube la foto como data URL base64 (`{ image: "data:image/..." }`)
 * porque el archivo todavía no está en Storage. Antes este endpoint solo aceptaba
 * `imageUrl`, así que la petición del formulario siempre daba 400. Ahora se
 * aceptan las dos formas, se decodifica el base64 y pasa por el mismo guard.
 */

/** 8 MB en base64 ocupan ~11,2 MB de texto; se deja margen para el prefijo. */
const MAX_DATA_URL_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 100;

const extractSchema = z
  .object({
    imageUrl: z.string().url('La URL de la imagen no es válida').max(2048).optional(),
    image: z
      .string()
      .max(MAX_DATA_URL_CHARS, 'La imagen supera el máximo de 8 MB')
      .regex(
        /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
        'La imagen debe ser un data URL JPEG, PNG o WebP'
      )
      .optional(),
  })
  .refine((data) => Boolean(data.imageUrl) !== Boolean(data.image), {
    message: 'Envía exactamente uno de "image" o "imageUrl"',
  });

/** Decodifica un data URL ya validado por el schema. */
function decodeDataUrl(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;

  const base64 = dataUrl.slice(comma + 1);
  const buffer = Buffer.from(base64, 'base64');

  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

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

  let imageBytes: Uint8Array;

  if (parsed.data.image) {
    const decoded = decodeDataUrl(parsed.data.image);

    if (!decoded) {
      return fail(res, 400, 'INVALID_INPUT', 'No se pudo decodificar la imagen enviada');
    }

    imageBytes = decoded;
  } else {
    const download = await fetchRemoteImage(parsed.data.imageUrl!, { maxBytes: MAX_IMAGE_BYTES });

    if (!download.ok) {
      return fail(res, 400, 'INVALID_INPUT', download.reason);
    }

    imageBytes = new Uint8Array(download.bytes);
  }

  const payload = toImagePayload(imageBytes);

  if (!payload.ok) {
    return fail(res, 400, 'INVALID_INPUT', payload.reason);
  }

  try {
    const provider = getAIProvider();

    /**
     * Errores de cada llamada. `detail` se queda en el log; `hint` es lo que ve
     * el usuario. Así un token inválido o una licencia sin aceptar se explican
     * sin filtrar credenciales ni la respuesta cruda de Cloudflare.
     */
    const providerErrors: Array<{ detail: string; hint: string; status: number }> = [];

    const collect = (error: unknown) => {
      if (error instanceof AIProviderError) {
        providerErrors.push({ detail: error.message, hint: error.hint, status: error.status });
        return null;
      }

      providerErrors.push({
        detail: error instanceof Error ? error.message : String(error),
        hint: `El proveedor de IA (${AI_PROVIDER}) no pudo analizar la imagen. Inténtalo de nuevo más tarde.`,
        status: 502,
      });

      return null;
    };

    // OCR y visión en paralelo. Los fallos individuales no tumban la respuesta.
    const [ocrResult, visionResult] = await Promise.all([
      provider.extractTextFromImage(payload.image).catch(collect),
      provider
        .analyzeImage(
          payload.image,
          'Analiza la foto de una mascota (perdida, encontrada o en adopción). Devuelve SOLO un JSON válido con: species (dog/cat/other), breed, color, size (small/medium/large), sex (male/female/unknown), age (puppy/young/adult/senior/unknown), collar (true/false), plate (true/false), characteristics. Si un dato no se ve, usa null. No inventes.'
        )
        .catch(collect),
    ]);

    if (!ocrResult && !visionResult) {
      console.error('[ai/extract-from-image] el proveedor falló', {
        provider: AI_PROVIDER,
        errors: providerErrors,
      });

      // Se prioriza cuota, credenciales o licencia sobre un fallo genérico.
      const primary =
        providerErrors.find(
          (error) => error.status === 429 || error.status === 401 || error.status === 403
        ) ?? providerErrors[0];

      const isConfigurationError =
        primary.status === 429 || primary.status === 401 || primary.status === 403;

      return fail(res, isConfigurationError ? 503 : 502, 'INTERNAL', primary.hint);
    }

    const extracted = buildFormExtraction({
      ocr: ocrResult ? { text: ocrResult.text, confidence: ocrResult.confidence } : null,
      vision: visionResult
        ? { labels: visionResult.labels, description: visionResult.description }
        : null,
    });

    return json(res, 200, {
      ok: true,
      extracted,
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
