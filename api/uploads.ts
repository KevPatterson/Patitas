import { z } from 'zod';
import type { VercelRequest, VercelResponse } from './types/vercel';
import { supabaseAdmin } from './_lib/supabase-admin';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from './_lib/http';
import { limitByIp, limitByUser } from './_lib/rate-limit-utils';
import { canManagePublication, getActor, loadPublication } from './_lib/authz';
import { sanitizeImage } from './_lib/image-process';
import { MAX_IMAGES } from '../src/lib/constants/labels';

/**
 * POST /api/uploads?action=<publication-image|avatar|delete-image>
 *
 * Único camino de escritura en Storage desde la migración 0014: los permisos de
 * INSERT/UPDATE/DELETE sobre `storage.objects` se retiran a `authenticated`, así
 * que subir directamente con supabase-js deja de funcionar y esta función (con
 * service role) pasa a ser obligatoria.
 *
 * Consecuencias, que son justo el objetivo de la Fase 3:
 *   - el tipo real se valida por magic bytes (no por el MIME que declara el
 *     cliente),
 *   - una imagen con GPS en EXIF se rechaza,
 *   - toda imagen se reencodea a WebP sin metadatos,
 *   - el nombre lo genera el servidor (uuid), nunca el del archivo original.
 */

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

const PUBLICATION_IMAGES_BUCKET = 'pet-images';
const AVATARS_BUCKET = 'avatars';

/** Límite del base64 recibido (≈ 8 MB de archivo real + cabecera data URI). */
const MAX_BASE64_LENGTH = 11_000_000;

/** Acepta tanto base64 puro como data URI (`data:image/webp;base64,...`). */
function decodeBase64(input: string): Uint8Array | null {
  const commaIndex = input.startsWith('data:') ? input.indexOf(',') : -1;
  const payload = commaIndex >= 0 ? input.slice(commaIndex + 1) : input;

  // Base64 estándar; se descarta cualquier espacio o salto de línea.
  const clean = payload.replace(/\s/g, '');

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    return null;
  }

  try {
    const buffer = Buffer.from(clean, 'base64');
    return buffer.byteLength > 0 ? new Uint8Array(buffer) : null;
  } catch {
    return null;
  }
}

const publicationImageSchema = z.object({
  publicationId: z.string().uuid('El identificador de la publicación no es válido'),
  dataBase64: z.string().min(16).max(MAX_BASE64_LENGTH),
  altText: z.string().trim().max(200).optional(),
});

const avatarSchema = z.object({
  dataBase64: z.string().min(16).max(MAX_BASE64_LENGTH),
});

const deleteSchema = z.object({
  storagePath: z.string().trim().min(3).max(500),
  bucket: z.enum([PUBLICATION_IMAGES_BUCKET, AVATARS_BUCKET]),
});

function actionOf(req: VercelRequest): string {
  const raw = req.query.action;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'uploads-ip', 200, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  switch (actionOf(req)) {
    case 'publication-image':
      return handlePublicationImage(req, res, auth.user.id);
    case 'avatar':
      return handleAvatar(req, res, auth.user.id);
    case 'delete-image':
      return handleDeleteImage(req, res, auth.user.id);
    default:
      return fail(
        res,
        400,
        'INVALID_INPUT',
        'Acción desconocida. Usa ?action=publication-image, ?action=avatar o ?action=delete-image'
      );
  }
}

// ───────────────────────────── Imagen de publicación ─────────────────────────

async function handlePublicationImage(req: VercelRequest, res: VercelResponse, userId: string) {
  const userLimit = await limitByUser(res, 'upload-publication-image', userId, 40, 3600_000);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, publicationImageSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const { publicationId, dataBase64, altText } = parsed.data;

  const publication = await loadPublication(supabaseAdmin, publicationId);

  if (!publication) {
    return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
  }

  const actor = await getActor(supabaseAdmin, userId);

  if (!canManagePublication(actor, publication)) {
    return fail(res, 403, 'FORBIDDEN', 'No puedes subir imágenes a esta publicación');
  }

  const { count, error: countError } = await supabaseAdmin
    .from('publication_images')
    .select('id', { count: 'exact', head: true })
    .eq('publication_id', publicationId);

  if (countError) {
    return internalError(res, 'uploads/count', countError);
  }

  const existing = count ?? 0;

  if (existing >= MAX_IMAGES) {
    return fail(res, 409, 'CONFLICT', `Máximo ${MAX_IMAGES} imágenes por publicación`);
  }

  const bytes = decodeBase64(dataBase64);

  if (!bytes) {
    return fail(res, 400, 'INVALID_INPUT', 'El archivo no es base64 válido');
  }

  const sanitized = await sanitizeImage(bytes, 'publication');

  if (!sanitized.ok) {
    // GPS y formato inválido son errores del usuario (400); el resto son 422/500.
    const status = sanitized.code === 'PROCESSING_FAILED' ? 422 : 400;
    return fail(res, status, 'INVALID_INPUT', sanitized.reason, { code_detail: sanitized.code });
  }

  // Nombre generado en servidor. Nunca el nombre original del archivo.
  const storagePath = `${publicationId}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(PUBLICATION_IMAGES_BUCKET)
    .upload(storagePath, sanitized.bytes, {
      contentType: sanitized.mimeType,
      upsert: false,
      cacheControl: '31536000',
    });

  if (uploadError) {
    return internalError(res, 'uploads/storage', uploadError);
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('publication_images')
    .insert({
      publication_id: publicationId,
      storage_path: storagePath,
      alt_text: altText ?? null,
      sort_order: existing,
      is_cover: existing === 0,
    })
    .select('id')
    .single();

  if (insertError) {
    // Si falla el registro, se borra el objeto para no dejar basura huérfana.
    await supabaseAdmin.storage.from(PUBLICATION_IMAGES_BUCKET).remove([storagePath]);
    return internalError(res, 'uploads/insert', insertError);
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(PUBLICATION_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  return json(res, 201, {
    ok: true,
    id: inserted.id,
    storagePath,
    publicUrl: publicUrlData.publicUrl,
    width: sanitized.width,
    height: sanitized.height,
    sizeBytes: sanitized.outputBytes,
    originalBytes: sanitized.originalBytes,
    // Se informa para que la UI pueda confirmar que la foto se limpió.
    metadata_removed: sanitized.hadMetadata,
  });
}

// ──────────────────────────────────── Avatar ─────────────────────────────────

async function handleAvatar(req: VercelRequest, res: VercelResponse, userId: string) {
  const userLimit = await limitByUser(res, 'upload-avatar', userId, 20, 3600_000);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, avatarSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const bytes = decodeBase64(parsed.data.dataBase64);

  if (!bytes) {
    return fail(res, 400, 'INVALID_INPUT', 'El archivo no es base64 válido');
  }

  // Mismas reglas que una foto, con lado y peso máximos menores.
  const sanitized = await sanitizeImage(bytes, 'avatar');

  if (!sanitized.ok) {
    const status = sanitized.code === 'PROCESSING_FAILED' ? 422 : 400;
    return fail(res, status, 'INVALID_INPUT', sanitized.reason, { code_detail: sanitized.code });
  }

  const storagePath = `${userId}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(AVATARS_BUCKET)
    .upload(storagePath, sanitized.bytes, {
      contentType: sanitized.mimeType,
      upsert: false,
      cacheControl: '31536000',
    });

  if (uploadError) {
    return internalError(res, 'uploads/avatar-storage', uploadError);
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(storagePath);

  const avatarUrl = publicUrlData.publicUrl;

  // Se actualiza el perfil con el service role: el usuario solo puede cambiar su
  // propio avatar, y el id viene del JWT, no del body.
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (updateError) {
    await supabaseAdmin.storage.from(AVATARS_BUCKET).remove([storagePath]);
    return internalError(res, 'uploads/avatar-profile', updateError);
  }

  return json(res, 201, {
    ok: true,
    avatarUrl,
    storagePath,
    width: sanitized.width,
    height: sanitized.height,
    sizeBytes: sanitized.outputBytes,
    metadata_removed: sanitized.hadMetadata,
  });
}

// ─────────────────────────────────── Borrado ─────────────────────────────────

async function handleDeleteImage(req: VercelRequest, res: VercelResponse, userId: string) {
  const userLimit = await limitByUser(res, 'upload-delete', userId, 60, 3600_000);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, deleteSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const { storagePath, bucket } = parsed.data;

  // El primer segmento del path identifica al dueño: la publicación o el usuario.
  const [firstSegment] = storagePath.split('/');

  if (!firstSegment || storagePath.includes('..')) {
    return fail(res, 400, 'INVALID_INPUT', 'Ruta de archivo no válida');
  }

  if (bucket === AVATARS_BUCKET) {
    if (firstSegment !== userId) {
      return fail(res, 403, 'FORBIDDEN', 'Ese archivo no es tuyo');
    }
  } else {
    const publication = await loadPublication(supabaseAdmin, firstSegment);

    if (!publication) {
      return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
    }

    const actor = await getActor(supabaseAdmin, userId);

    if (!canManagePublication(actor, publication)) {
      return fail(res, 403, 'FORBIDDEN', 'No puedes borrar imágenes de esta publicación');
    }
  }

  const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove([storagePath]);

  if (removeError) {
    return internalError(res, 'uploads/delete-storage', removeError);
  }

  if (bucket === PUBLICATION_IMAGES_BUCKET) {
    const { error: deleteError } = await supabaseAdmin
      .from('publication_images')
      .delete()
      .eq('storage_path', storagePath)
      .eq('publication_id', firstSegment);

    if (deleteError) {
      return internalError(res, 'uploads/delete-row', deleteError);
    }
  }

  return json(res, 200, { ok: true, storagePath });
}
