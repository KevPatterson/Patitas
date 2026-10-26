import sharp from 'sharp';
import {
  containsGpsMetadata,
  detectImage,
  MAX_AVATAR_BYTES,
  MAX_IMAGE_BYTES,
} from './image-guard.js';

/**
 * Saneado de imágenes en el servidor.
 *
 * Por qué aquí y no solo en el cliente: el cliente es controlable. Un usuario
 * puede subir la foto original con EXIF usando supabase-js sin pasar por la UI,
 * así que el saneado tiene que ocurrir en un punto que no pueda saltarse. Por eso
 * la migración 0015 retira los permisos de escritura sobre `storage.objects` a
 * `authenticated`: la única vía de subida es `/api/uploads`, que usa el service
 * role y **siempre** pasa por esta función.
 *
 * Qué hace `sanitizeImage`:
 *   1. Verifica el tipo real por magic bytes (JPEG/PNG/WebP; rechaza SVG y GIF).
 *   2. Rechaza la imagen si lleva EXIF con GPS (política del plan: no se acepta,
 *      se pide que el cliente la reencodee).
 *   3. Re-encodea con sharp: aplica la orientación, limita el lado largo,
 *      convierte a WebP y **descarta todos los metadatos** (sharp los elimina por
 *      defecto; no se llama nunca a `withMetadata()`).
 *   4. Baja la calidad hasta cumplir el objetivo de peso (conexiones lentas).
 *   5. Vuelve a comprobar el resultado: si apareciera cualquier rastro de GPS,
 *      se descarta (defensa en profundidad).
 */

/** Lado largo máximo de una foto de publicación. */
export const PUBLICATION_MAX_SIDE = 1600;
/** Objetivo de peso por imagen de publicación (1 MB, como pide el plan). */
export const PUBLICATION_TARGET_BYTES = 1024 * 1024;

/** Lado largo máximo de un avatar. */
export const AVATAR_MAX_SIDE = 512;
/** Objetivo de peso por avatar. */
export const AVATAR_TARGET_BYTES = 300 * 1024;

/** Calidades que se prueban en orden hasta cumplir el objetivo de peso. */
const QUALITY_STEPS = [82, 74, 66, 58, 50] as const;

export type SanitizeVariant = 'publication' | 'avatar';

export type SanitizeOptions = {
  /**
   * Rechaza la imagen si trae GPS (comportamiento de las subidas del usuario).
   *
   * Las imágenes que se importan de terceros (por ejemplo, el `og:image` de
   * Facebook) no las subió el usuario y no puede corregirlas: en ese caso se
   * reencodean igualmente y el GPS se descarta con el resto de metadatos.
   */
  rejectGps?: boolean;
};

export type SanitizeResult =
  | {
      ok: true;
      bytes: Buffer;
      mimeType: 'image/webp';
      width: number | null;
      height: number | null;
      originalBytes: number;
      outputBytes: number;
      /** true si la imagen de entrada traía metadatos EXIF (aunque sin GPS). */
      hadMetadata: boolean;
    }
  | { ok: false; code: SanitizeErrorCode; reason: string };

export type SanitizeErrorCode =
  | 'INVALID_IMAGE'
  | 'GPS_METADATA'
  | 'TOO_LARGE'
  | 'TOO_BIG_DIMENSIONS'
  | 'PROCESSING_FAILED';

/** Detecta si los bytes tienen un bloque APP1/Exif (metadatos, con o sin GPS). */
export function hasExifBlock(bytes: Uint8Array): boolean {
  for (let i = 0; i + 10 < bytes.length && i < 4096; i++) {
    if (
      bytes[i] === 0xff &&
      bytes[i + 1] === 0xe1 &&
      bytes[i + 4] === 0x45 && // E
      bytes[i + 5] === 0x78 && // x
      bytes[i + 6] === 0x69 && // i
      bytes[i + 7] === 0x66 // f
    ) {
      return true;
    }
  }

  return false;
}

/** Lado máximo de entrada según la variante. */
function maxInputBytes(variant: SanitizeVariant): number {
  return variant === 'avatar' ? MAX_AVATAR_BYTES : MAX_IMAGE_BYTES;
}

/** Lado largo y peso objetivo según la variante. */
function targetFor(variant: SanitizeVariant): { side: number; bytes: number } {
  return variant === 'avatar'
    ? { side: AVATAR_MAX_SIDE, bytes: AVATAR_TARGET_BYTES }
    : { side: PUBLICATION_MAX_SIDE, bytes: PUBLICATION_TARGET_BYTES };
}

/**
 * Sanea una imagen. Devuelve siempre WebP sin metadatos.
 *
 * No lanza: los fallos se devuelven como `ok: false` con un código estable para
 * que el endpoint pueda responder 4xx/5xx sin filtrar detalles internos.
 */
export async function sanitizeImage(
  bytes: Uint8Array,
  variant: SanitizeVariant,
  options: SanitizeOptions = {}
): Promise<SanitizeResult> {
  const limit = maxInputBytes(variant);
  const target = targetFor(variant);
  const rejectGps = options.rejectGps ?? true;

  // 1. Tipo real por contenido.
  const detected = detectImage(bytes, limit);

  if (!detected.ok) {
    return {
      ok: false,
      code: detected.reason.includes('supera') ? 'TOO_LARGE' : 'INVALID_IMAGE',
      reason: detected.reason,
    };
  }

  // 2. GPS: se rechaza la subida, no se "limpia" en silencio. Así el usuario se
  // entera de que su foto llevaba su ubicación.
  if (rejectGps && containsGpsMetadata(bytes)) {
    return {
      ok: false,
      code: 'GPS_METADATA',
      reason:
        'La imagen contiene la ubicación GPS en sus metadatos. Vuelve a guardarla sin ubicación y súbela de nuevo.',
    };
  }

  const hadMetadata = hasExifBlock(bytes);

  // 3-4. Re-encodeo y ajuste de calidad.
  try {
    let best: { bytes: Buffer; width: number | null; height: number | null } | null = null;

    for (const quality of QUALITY_STEPS) {
      const output = await sharp(Buffer.from(bytes))
        // Aplica la orientación EXIF a los píxeles y luego descarta el EXIF.
        .rotate()
        .resize({
          width: target.side,
          height: target.side,
          fit: 'inside',
          withoutEnlargement: true,
        })
        // Sin `withMetadata()`: sharp elimina EXIF, IPTC y XMP por defecto.
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });

      best = { bytes: output.data, width: output.info.width, height: output.info.height };

      if (output.data.byteLength <= target.bytes) {
        break;
      }
    }

    if (!best) {
      return { ok: false, code: 'PROCESSING_FAILED', reason: 'No se pudo procesar la imagen' };
    }

    if (best.bytes.byteLength > target.bytes) {
      return {
        ok: false,
        code: 'TOO_LARGE',
        reason: `No se pudo reducir la imagen por debajo de ${Math.round(target.bytes / 1024)} KB. Prueba con otra foto.`,
      };
    }

    // 5. Defensa en profundidad: el resultado NO puede llevar GPS.
    if (containsGpsMetadata(best.bytes)) {
      return {
        ok: false,
        code: 'PROCESSING_FAILED',
        reason: 'No se pudieron eliminar los metadatos de la imagen',
      };
    }

    return {
      ok: true,
      bytes: best.bytes,
      mimeType: 'image/webp',
      width: best.width,
      height: best.height,
      originalBytes: bytes.byteLength,
      outputBytes: best.bytes.byteLength,
      hadMetadata,
    };
  } catch (error) {
    console.error('[image-process] sharp falló', error);
    return {
      ok: false,
      code: 'PROCESSING_FAILED',
      reason: 'No se pudo procesar la imagen. Inténtalo de nuevo.',
    };
  }
}
