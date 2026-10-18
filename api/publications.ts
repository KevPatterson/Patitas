import { z } from 'zod';
import type { VercelRequest, VercelResponse } from './types/vercel';
import { supabaseAdmin } from './_lib/supabase-admin';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from './_lib/http';
import { limitByIp, limitByUser } from './_lib/rate-limit-utils';
import { canManagePublication, getActor, loadPublication } from './_lib/authz';

/**
 * POST /api/publications?action=<create|validate-upload>
 *
 * Router de publicaciones. Hallazgo API-11: `create` solo comprobaba que
 * `title`, `description` y `type` estuvieran presentes, sin validar enums ni
 * longitudes, y devolvía `ok: true` sin hacer nada más. Se añade Zod y se
 * documenta explícitamente que la creación real ocurre en el cliente bajo RLS
 * (este endpoint existe para aplicar cuota y validar antes de subir archivos).
 *
 * `validate-upload` ya comprobaba propiedad, pero usaba el MIME declarado por el
 * cliente. Se mantiene como comprobación previa, pero el MIME real se verifica
 * por magic bytes en el momento de la subida (Fase 3).
 */

const PUBLICATION_TYPES = ['LOST', 'FOUND', 'ABANDONED', 'ADOPTION', 'SIGHTING'] as const;

/** Tipos aceptados por el bucket. GIF queda fuera a propósito (Fase 3). */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB, igual que el bucket
const MAX_IMAGES_PER_PUBLICATION = 10;

const createSchema = z.object({
  title: z.string().trim().min(5, 'El título es demasiado corto').max(140, 'El título es demasiado largo'),
  description: z
    .string()
    .trim()
    .min(15, 'La descripción es demasiado corta')
    .max(5000, 'La descripción es demasiado larga'),
  type: z.enum(PUBLICATION_TYPES),
  species: z.string().trim().min(2).max(60).optional(),
  province: z.string().trim().max(80).optional(),
  municipality: z.string().trim().max(80).optional(),
});

const validateUploadSchema = z.object({
  publicationId: z.string().uuid().optional(),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024).optional(),
  mimeType: z.string().max(120).optional(),
});

function actionOf(req: VercelRequest): string {
  const raw = req.query.action;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'publications-ip', 120, 3600_000);
  if (!ipLimit.ok) return;

  switch (actionOf(req)) {
    case 'create':
      return handleCreate(req, res);
    case 'validate-upload':
      return handleValidateUpload(req, res);
    default:
      return fail(
        res,
        400,
        'INVALID_INPUT',
        'Acción desconocida. Usa ?action=create o ?action=validate-upload'
      );
  }
}

// ============================================================================
// CREATE
// ============================================================================
async function handleCreate(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  // Cuota por usuario: la creación real la hace el cliente, así que este es el
  // único punto donde se puede limitar sin tocar RLS.
  const userLimit = await limitByUser(res, 'publication-create', auth.user.id, 10, 3600_000);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, createSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  return json(res, 200, {
    ok: true,
    message: 'La publicación se puede crear',
    // La inserción definitiva la hace el cliente bajo RLS; aquí solo se valida y
    // se aplica cuota, tal como está diseñada la arquitectura del proyecto.
    created_on_client: true,
  });
}

// ============================================================================
// VALIDATE UPLOAD
// ============================================================================
async function handleValidateUpload(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const userLimit = await limitByUser(res, 'upload-validate', auth.user.id, 50, 3600_000);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, validateUploadSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const { publicationId, fileSize, mimeType } = parsed.data;

  if (publicationId) {
    const publication = await loadPublication(supabaseAdmin, publicationId);

    if (!publication) {
      return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
    }

    const actor = await getActor(supabaseAdmin, auth.user.id);

    if (!canManagePublication(actor, publication)) {
      return fail(res, 403, 'FORBIDDEN', 'No puedes subir imágenes a esta publicación');
    }

    const { count, error: countError } = await supabaseAdmin
      .from('publication_images')
      .select('id', { count: 'exact', head: true })
      .eq('publication_id', publicationId);

    if (countError) {
      return internalError(res, 'publications/count-images', countError);
    }

    if (count !== null && count >= MAX_IMAGES_PER_PUBLICATION) {
      return fail(
        res,
        409,
        'CONFLICT',
        `Máximo ${MAX_IMAGES_PER_PUBLICATION} imágenes por publicación`
      );
    }
  }

  if (mimeType && !(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return fail(res, 400, 'INVALID_INPUT', 'Tipo de archivo no permitido. Usa JPEG, PNG o WebP.');
  }

  if (fileSize && fileSize > MAX_FILE_SIZE) {
    return fail(res, 400, 'INVALID_INPUT', 'El archivo supera el máximo de 8 MB');
  }

  return json(res, 200, {
    ok: true,
    message: 'Validación de subida correcta',
    // El cliente debe recordar que el MIME declarado no es concluyente.
    mime_hint: 'El tipo real se verificará por contenido al subir el archivo.',
  });
}
