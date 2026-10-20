import type { ImagePayload } from './ai-provider.js';
import { fetchRemoteImage } from './url-guard.js';

/**
 * Validación de imágenes por contenido real (magic bytes), no por el MIME
 * declarado.
 *
 * Hallazgo API-05/03-Fase3: `facebook-screenshot` validaba `file.type`, un valor
 * que envía el cliente y que se puede poner a `image/jpeg` en un `.php` o en un
 * SVG con JavaScript dentro. Aquí se miran los primeros bytes del archivo.
 *
 * Formatos aceptados: JPEG, PNG y WebP. Se rechaza explícitamente:
 *   - SVG (es XML y puede llevar script; además no tiene magic bytes),
 *   - GIF (el enunciado pide rechazar los animados, y distinguirlos exige
 *     inspeccionar los frames: se rechaza el formato completo),
 *   - cualquier otra cosa, incluido un `.php` renombrado a `.jpg`.
 */

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB, igual que el bucket
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB, igual que el bucket
export const MAX_IMAGE_DIMENSION = 8000; // lado máximo permitido

export type DetectedImage =
  | { ok: true; mimeType: ImageMime; width: number | null; height: number | null }
  | { ok: false; reason: string };

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/** Dimensiones para PNG (IHDR) y JPEG (SOF). WebP se resuelve en su rama. */
function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  // Firma(8) + longitud(4) + "IHDR"(4) + width(4) + height(4)
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;

  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }

    const marker = bytes[i + 1]!;

    // Marcadores sin payload.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }

    const length = (bytes[i + 2]! << 8) + bytes[i + 3]!;
    if (length < 2) return null;

    // SOF0..SOF15 (excepto DHT=0xc4, JPG=0xc8, DAC=0xcc) llevan dimensiones.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isSof) {
      if (i + 9 >= bytes.length) return null;
      const height = (bytes[i + 5]! << 8) + bytes[i + 6]!;
      const width = (bytes[i + 7]! << 8) + bytes[i + 8]!;
      return { width, height };
    }

    i += 2 + length;
  }

  return null;
}

function readWebpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const format = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);

  if (format === 'VP8 ') {
    // VP8 simple: dimensiones en el frame header.
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }

  if (format === 'VP8L') {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  if (format === 'VP8X') {
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return { width, height };
  }

  return null;
}

/**
 * Detecta el tipo real de la imagen a partir de sus bytes.
 *
 * @param bytes     Contenido completo del archivo.
 * @param maxBytes  Límite de tamaño según el destino (publicación o avatar).
 */
export function detectImage(bytes: Uint8Array, maxBytes = MAX_IMAGE_BYTES): DetectedImage {
  if (bytes.length === 0) {
    return { ok: false, reason: 'El archivo está vacío' };
  }

  if (bytes.length > maxBytes) {
    return { ok: false, reason: `La imagen supera el máximo de ${Math.round(maxBytes / 1024 / 1024)} MB` };
  }

  // SVG: es texto. Se comprueba antes que nada para dar un mensaje claro, porque
  // un SVG con <script> es el caso de XSS almacenado más habitual.
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, 512))
    .trim()
    .toLowerCase();

  if (head.startsWith('<?xml') || head.startsWith('<svg') || head.includes('<svg')) {
    return { ok: false, reason: 'Los archivos SVG no están permitidos por seguridad' };
  }

  // GIF89a / GIF87a
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return { ok: false, reason: 'Los archivos GIF no están permitidos. Usa JPEG, PNG o WebP.' };
  }

  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    const size = readJpegSize(bytes);
    if (size && (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION)) {
      return { ok: false, reason: `La imagen es demasiado grande (máximo ${MAX_IMAGE_DIMENSION} px por lado)` };
    }
    return { ok: true, mimeType: 'image/jpeg', width: size?.width ?? null, height: size?.height ?? null };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const size = readPngSize(bytes);
    if (size && (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION)) {
      return { ok: false, reason: `La imagen es demasiado grande (máximo ${MAX_IMAGE_DIMENSION} px por lado)` };
    }
    return { ok: true, mimeType: 'image/png', width: size?.width ?? null, height: size?.height ?? null };
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    const size = readWebpSize(bytes);
    if (size && (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION)) {
      return { ok: false, reason: `La imagen es demasiado grande (máximo ${MAX_IMAGE_DIMENSION} px por lado)` };
    }
    return { ok: true, mimeType: 'image/webp', width: size?.width ?? null, height: size?.height ?? null };
  }

  return {
    ok: false,
    reason: 'El archivo no es una imagen válida. Solo se permiten JPEG, PNG y WebP.',
  };
}

/**
 * Predicados de tipo para los resultados de este módulo.
 *
 * Hacen falta porque TypeScript solo estrecha uniones con discriminante booleano
 * si `strictNullChecks` está activo, y Vercel compila `api/` con su propia
 * configuración. Los predicados funcionan con `strict` y sin él.
 */
function isDetectedImageFailure(
  detected: DetectedImage
): detected is { ok: false; reason: string } {
  return detected.ok === false;
}

function isDetectedImageOk(
  detected: DetectedImage
): detected is { ok: true; mimeType: ImageMime; width: number | null; height: number | null } {
  return detected.ok === true;
}

/**
 * Convierte bytes ya descargados en el payload que consume el proveedor de IA.
 * Devuelve el motivo si el contenido no es una imagen aceptada.
 */
export function toImagePayload(
  bytes: Uint8Array,
  sourceUrl?: string,
  maxBytes = MAX_IMAGE_BYTES
): { ok: true; image: ImagePayload } | { ok: false; reason: string } {
  const detected = detectImage(bytes, maxBytes);

  if (isDetectedImageFailure(detected)) {
    return { ok: false, reason: detected.reason };
  }

  if (!isDetectedImageOk(detected)) {
    return { ok: false, reason: 'No se pudo determinar el tipo de la imagen' };
  }

  return {
    ok: true,
    image: { bytes, mimeType: detected.mimeType, sourceUrl },
  };
}

/**
 * Descarga una imagen de nuestro propio Supabase Storage y la valida.
 *
 * Se usa en el procesamiento asíncrono, donde la URL se construye con el
 * `storage_path` de la base de datos y no viene del cliente. Aun así pasa por el
 * guard: solo se saltan las comprobaciones de DNS/IP porque es un host propio
 * (declarado en `trustedHosts`), nunca por ser una URL "de confianza".
 */
export async function loadOwnStorageImage(
  imageUrl: string
): Promise<{ ok: true; image: ImagePayload } | { ok: false; reason: string }> {
  const download = await fetchRemoteImage(imageUrl, {
    maxBytes: MAX_IMAGE_BYTES,
    trustedHosts: [],
  });

  if (download.ok === false) {
    return { ok: false, reason: download.reason };
  }

  return toImagePayload(new Uint8Array(download.bytes), imageUrl);
}

/**
 * Comprueba que la imagen no lleva metadatos GPS.
 *
 * Se usa en el servidor como segunda barrera: el cliente ya debe haber
 * reencodeado la imagen (Fase 3), pero aquí se verifica de nuevo porque el
 * cliente es controlable. Un JPEG con EXIF GPS contiene el tag 0x8825 y el
 * marcador "GPS" en el bloque APP1.
 */
export function containsGpsMetadata(bytes: Uint8Array): boolean {
  // Marcador APP1 con cabecera Exif\0\0
  const hasExif = (() => {
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
  })();

  if (!hasExif) return false;

  // Cabecera del IFD0: buscar el puntero al IFD de GPS (tag 0x8825).
  const text = Buffer.from(bytes.slice(0, Math.min(bytes.length, 65536))).toString('latin1');
  if (text.includes('GPS')) return true;

  // 0x8825 little-endian y big-endian.
  const le = Buffer.from([0x25, 0x88]).toString('latin1');
  const be = Buffer.from([0x88, 0x25]).toString('latin1');

  return text.includes(le) || text.includes(be);
}
