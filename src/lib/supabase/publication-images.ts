import { supabase } from './client';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGES } from '../constants/labels';
import {
  blobToBase64,
  compressImage,
  CompressionError,
  type CompressionProgress,
} from '../utils/image-compression';

/**
 * Subida de imágenes de publicación.
 *
 * Cambio de la Fase 3: la escritura en Storage ya no la hace el cliente. Desde la
 * migración 0015 no hay política de INSERT para `authenticated`, así que subir con
 * `supabase.storage.upload()` devuelve "new row violates row-level security
 * policy". Todo pasa por `/api/uploads`, que:
 *
 *   - comprime y reencodea (quita EXIF) con sharp,
 *   - rechaza las imágenes con GPS,
 *   - valida el tipo por magic bytes,
 *   - pone un nombre uuid generado en servidor,
 *   - registra la fila en `publication_images`.
 *
 * En el cliente se comprime antes de enviar (red 1600 px, objetivo 1 MB) para no
 * gastar datos en Cuba; el servidor vuelve a comprobar y sanear.
 */

export type UploadProgress = CompressionProgress & {
  /** 1-based, archivo que se está subiendo. */
  uploadingIndex: number;
  /** 0-100 del envío. */
  uploadPercent: number;
};

export type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  /** Reintentos por archivo ante fallo de red (0 = sin reintentos). */
  retries?: number;
};

export type UploadedImage = {
  id: string;
  storagePath: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  metadataRemoved: boolean;
};

type UploadApiResponse = {
  ok?: boolean;
  id?: string;
  storagePath?: string;
  publicUrl?: string;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number;
  metadata_removed?: boolean;
  error?: string;
  code?: string;
};

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** POST a /api/uploads con el token de la sesión actual. */
async function postUploads(
  action: 'publication-image' | 'avatar' | 'delete-image',
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: UploadApiResponse }> {
  const token = await accessToken();

  if (!token) {
    throw new CompressionError('Necesitas iniciar sesión para subir imágenes');
  }

  const response = await fetch(`/api/uploads?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let data: UploadApiResponse = {};

  try {
    data = (await response.json()) as UploadApiResponse;
  } catch {
    // Respuesta sin JSON (por ejemplo, un 413 de Vercel): se deja vacío.
  }

  return { ok: response.ok, status: response.status, data };
}

/** Reintenta una operación con una espera creciente entre intentos. */
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error = new CompressionError('Error desconocido al subir la imagen');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        onRetry?.(attempt + 1, lastError);
        // 400/403/413 no se arreglan reintentando: solo red y 5xx.
        if (/^(No |Necesitas|El archivo|La imagen)/.test(lastError.message)) break;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Comprime y sube una o varias imágenes de una publicación.
 *
 * Se procesan **en serie** a propósito: en conexiones lentas, lanzar 8 subidas en
 * paralelo satura la conexión y multiplica los timeouts.
 */
export async function uploadPublicationImages(
  publicationId: string,
  files: File[],
  options: UploadOptions = {}
): Promise<UploadedImage[]> {
  if (files.length > MAX_IMAGES) {
    throw new Error(`Máximo ${MAX_IMAGES} imágenes por publicación.`);
  }

  const retries = options.retries ?? 2;
  const uploaded: UploadedImage[] = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index]!;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      throw new Error(`Formato no permitido: ${file.type || 'desconocido'}. Usa JPG, PNG o WebP.`);
    }

    const compression = await compressImage(file, {
      fileIndex: index + 1,
      totalFiles: files.length,
      onProgress: (progress) =>
        options.onProgress?.({
          ...progress,
          uploadingIndex: index + 1,
          uploadPercent: 0,
        }),
    });

    options.onProgress?.({
      fileIndex: index + 1,
      totalFiles: files.length,
      percent: 100,
      stage: 'done',
      uploadingIndex: index + 1,
      uploadPercent: 10,
    });

    const dataBase64 = await blobToBase64(compression.blob);

    const result = await withRetry(
      async () => {
        const response = await postUploads('publication-image', {
          publicationId,
          dataBase64,
          altText: file.name.slice(0, 200),
        });

        if (!response.ok || !response.data.publicUrl || !response.data.storagePath) {
          throw new Error(
            response.data.error ??
              (response.status === 413
                ? 'La imagen es demasiado grande para enviarla'
                : 'No se pudo subir la imagen')
          );
        }

        return response.data;
      },
      retries,
      (attempt) => {
        options.onProgress?.({
          fileIndex: index + 1,
          totalFiles: files.length,
          percent: 100,
          stage: 'encoding',
          uploadingIndex: index + 1,
          uploadPercent: 10,
          ...{ retryAttempt: attempt },
        });
      }
    );

    uploaded.push({
      id: result.id ?? '',
      storagePath: result.storagePath!,
      publicUrl: result.publicUrl!,
      width: result.width ?? null,
      height: result.height ?? null,
      sizeBytes: result.sizeBytes ?? compression.compressedBytes,
      metadataRemoved: result.metadata_removed ?? compression.metadataRemoved,
    });

    options.onProgress?.({
      fileIndex: index + 1,
      totalFiles: files.length,
      percent: 100,
      stage: 'done',
      uploadingIndex: index + 1,
      uploadPercent: 100,
    });
  }

  return uploaded;
}

/**
 * Borra imágenes de una publicación (Storage + fila en la base de datos).
 *
 * Antes lo hacía el cliente directamente contra Storage; ahora pasa por la API,
 * que comprueba la propiedad del path antes de tocar nada.
 */
export async function deletePublicationImages(
  publicationId: string,
  storagePaths: string[]
): Promise<void> {
  if (storagePaths.length === 0) return;

  for (const storagePath of storagePaths) {
    const response = await postUploads('delete-image', {
      storagePath,
      bucket: 'pet-images',
    });

    if (!response.ok) {
      // Se registra pero no se interrumpe: la publicación ya no referencia la
      // imagen, así que un objeto huérfano es menos grave que fallar al guardar.
      console.warn(
        `[deletePublicationImages] no se pudo borrar ${storagePath}:`,
        response.data.error
      );
    }
  }

  void publicationId;
}

export type { UploadApiResponse };
