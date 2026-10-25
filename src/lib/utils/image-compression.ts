/**
 * Compresión de imágenes en el cliente.
 *
 * Contexto Cuba: las conexiones son lentas y caras, así que subir una foto de
 * 8 MB es inviable. Aquí se redimensiona a un máximo de 1600 px de lado largo y
 * se baja la calidad hasta quedar por debajo de 1 MB.
 *
 * Además, **reencoar con canvas elimina todos los metadatos**, incluido el EXIF
 * con la geolocalización: los píxeles se redibujan en un canvas nuevo y se
 * exportan, así que el archivo resultante no arrastra la información del
 * original. Esa es la primera capa de la tarea 3.1; el servidor (`/api/uploads`)
 * vuelve a verificarlo porque el cliente siempre es controlable.
 *
 * Nota: `createImageBitmap` + `OffscreenCanvas` serían más eficientes, pero se usa
 * `Image` + `<canvas>` por compatibilidad con navegadores antiguos que aún se ven
 * en el contexto del proyecto.
 */

export const MAX_LONG_SIDE = 1600;
export const TARGET_BYTES = 1024 * 1024; // 1 MB
export const AVATAR_LONG_SIDE = 512;
export const AVATAR_TARGET_BYTES = 300 * 1024;

const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42];

export type CompressionProgress = {
  /** Archivo que se está procesando (1-based). */
  fileIndex: number;
  totalFiles: number;
  /** 0-100. */
  percent: number;
  stage: 'reading' | 'resizing' | 'encoding' | 'done';
};

export type CompressionOptions = {
  maxLongSide?: number;
  targetBytes?: number;
  onProgress?: (progress: CompressionProgress) => void;
  fileIndex?: number;
  totalFiles?: number;
};

export type CompressionResult = {
  blob: Blob;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  /** true si el original traía un bloque EXIF (se eliminó al reencodear). */
  metadataRemoved: boolean;
};

export class CompressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompressionError';
  }
}

/** Lee un File como data URL (base). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new CompressionError('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/** Carga una imagen desde un data URL. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new CompressionError('El archivo no es una imagen válida'));
    image.src = dataUrl;
  });
}

/** Comprueba si el original declara un bloque EXIF (solo para informar al usuario). */
function declaresExif(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);

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

/** Convierte un canvas a Blob WebP. */
function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new CompressionError('No se pudo comprimir la imagen'));
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Redimensiona y comprime una imagen.
 *
 * Siempre devuelve WebP (mejor compresión y soporta transparencia). Si el
 * navegador no soporta WebP, `canvas.toBlob` devuelve PNG en algunos motores muy
 * antiguos; en ese caso el servidor lo rechaza con un mensaje claro, que es mejor
 * que subir algo que no se puede validar.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const maxLongSide = options.maxLongSide ?? MAX_LONG_SIDE;
  const targetBytes = options.targetBytes ?? TARGET_BYTES;
  const fileIndex = options.fileIndex ?? 1;
  const totalFiles = options.totalFiles ?? 1;

  const report = (percent: number, stage: CompressionProgress['stage']) =>
    options.onProgress?.({ fileIndex, totalFiles, percent, stage });

  report(5, 'reading');

  const originalBuffer = await file.arrayBuffer();
  const metadataRemoved = declaresExif(originalBuffer);

  const dataUrl = await readAsDataUrl(file);
  report(20, 'reading');

  const image = await loadImage(dataUrl);
  report(35, 'resizing');

  const longestSide = Math.max(image.width, image.height);
  const scale = longestSide > maxLongSide ? maxLongSide / longestSide : 1;

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new CompressionError('Tu navegador no permite procesar imágenes');
  }

  // Fondo blanco para que un PNG con transparencia no se vea negro al pasar a un
  // formato sin canal alfa en algunos decodificadores.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  report(55, 'encoding');

  let blob: Blob | null = null;

  for (let i = 0; i < QUALITY_STEPS.length; i++) {
    const quality = QUALITY_STEPS[i]!;
    blob = await canvasToBlob(canvas, quality);

    report(55 + Math.round(((i + 1) / QUALITY_STEPS.length) * 40), 'encoding');

    if (blob.size <= targetBytes) break;
  }

  if (!blob) {
    throw new CompressionError('No se pudo comprimir la imagen');
  }

  if (blob.size > targetBytes) {
    throw new CompressionError(
      `No se pudo reducir la imagen por debajo de ${Math.round(targetBytes / 1024)} KB. Prueba con otra foto.`
    );
  }

  report(100, 'done');

  return {
    blob,
    width,
    height,
    originalBytes: originalBuffer.byteLength,
    compressedBytes: blob.size,
    metadataRemoved,
  };
}

/** Comprime un avatar: mismas reglas, lado y peso menores. */
export function compressAvatar(
  file: File,
  options: Omit<CompressionOptions, 'maxLongSide' | 'targetBytes'> = {}
): Promise<CompressionResult> {
  return compressImage(file, {
    ...options,
    maxLongSide: AVATAR_LONG_SIDE,
    targetBytes: AVATAR_TARGET_BYTES,
  });
}

/** Convierte un Blob a base64 puro (sin el prefijo `data:`). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new CompressionError('No se pudo preparar la imagen'));
    reader.readAsDataURL(blob);
  });
}

/** Lado máximo para las imágenes que se envían al autocompletado con IA. */
export const AI_IMPORT_MAX_SIDE = 1280;

/**
 * Prepara una imagen para el autocompletado con IA: 1280 px de lado y JPEG 85 %.
 *
 * El formulario envía la imagen como data URL base64 (un 33 % más de tamaño) y
 * el modelo de visión factura tokens de imagen: con 1280 px se lee igual el
 * texto de un cartel gastando muchos menos.
 */
export async function fileToDataUrl(file: File): Promise<string> {
  try {
    const dataUrl = await readAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const longestSide = Math.max(image.width, image.height);
    const scale = longestSide > AI_IMPORT_MAX_SIDE ? AI_IMPORT_MAX_SIDE / longestSide : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new CompressionError('Tu navegador no permite procesar imágenes');
    }

    // Fondo blanco: un PNG con transparencia se vería negro al pasar a JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    // Si el navegador no puede decodificar la imagen, se envía el original.
    return readAsDataUrl(file);
  }
}
