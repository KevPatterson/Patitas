import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../_lib/http';
import { limitByIp, limitByUser } from '../_lib/rate-limit-utils';
import { canManagePublication, getActor, loadPublication, writeAuditLog } from '../_lib/authz';

/**
 * POST /api/takedown — solicitud de retirada de contenido.
 *
 * Hallazgo API-04 (crítico): antes la autenticación era opcional "por diseño" y,
 * tras crear la solicitud, el endpoint ocultaba la publicación con
 * `.update({ status: 'HIDDEN' })` **sin comprobar quién la pedía**. Un anónimo
 * que conociera un UUID podía censurar cualquier publicación.
 *
 * Comportamiento nuevo:
 *
 *   - Se exige sesión. Sin JWT no hay solicitud (401).
 *   - Si quien pide es el **dueño** de la publicación o un **moderador**, la
 *     publicación se oculta de inmediato y queda pendiente de revisión (es
 *     exactamente el caso legítimo: "esta foto mía está publicada sin permiso").
 *   - En cualquier otro caso se registra la solicitud como `PENDING` y **no se
 *     toca la publicación**: pasa a la cola de moderación. Así se conserva la vía
 *     de denuncia de copyright sin dar un botón de censura a cualquiera.
 *   - Cada acción queda en `audit_logs` y el error del log ya no se ignora.
 */

const TAKEDOWN_REASONS = ['COPYRIGHT', 'PRIVACY', 'INACCURATE', 'OTHER'] as const;

const takedownSchema = z.object({
  publication_id: z.string().uuid('El identificador de la publicación no es válido'),
  reason: z.enum(TAKEDOWN_REASONS),
  contact_email: z.string().trim().email('El email de contacto no es válido').max(254).optional(),
  details: z
    .string()
    .trim()
    .max(2000, 'La descripción es demasiado larga (máximo 2000 caracteres)')
    .optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  // Barrera por IP antes de tocar la base de datos (frena la fuerza bruta de UUIDs).
  const ipLimit = await limitByIp(req, res, 'takedown-ip', 10, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const parsed = parseBody(req, takedownSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const { publication_id, reason, contact_email, details } = parsed.data;

  const userLimit = await limitByUser(res, 'takedown-user', auth.user.id, 5, 3600_000);
  if (!userLimit.ok) return;

  const publication = await loadPublication(supabaseAdmin, publication_id);

  if (!publication) {
    return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
  }

  if (publication.status !== 'ACTIVE' && publication.status !== 'RESOLVED') {
    return fail(res, 400, 'INVALID_INPUT', 'La publicación no está activa');
  }

  const actor = await getActor(supabaseAdmin, auth.user.id);

  if (!actor) {
    return fail(res, 403, 'FORBIDDEN', 'Tu perfil no está disponible todavía');
  }

  // ¿Puede este usuario ocultar la publicación por sí mismo?
  const canHide = canManagePublication(actor, publication);

  const { data: existingRequest, error: existingError } = await supabaseAdmin
    .from('takedown_requests')
    .select('id')
    .eq('publication_id', publication_id)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (existingError) {
    return internalError(res, 'takedown/existing', existingError);
  }

  if (existingRequest) {
    return fail(
      res,
      409,
      'CONFLICT',
      'Ya existe una solicitud de retirada pendiente para esta publicación'
    );
  }

  const { data: takedown, error: takedownError } = await supabaseAdmin
    .from('takedown_requests')
    .insert({
      publication_id,
      reason,
      contact_email: contact_email ?? null,
      status: 'PENDING',
      review_notes: details ?? null,
      previous_status: publication.status,
    })
    .select('id, created_at')
    .single();

  if (takedownError || !takedown) {
    return internalError(res, 'takedown/insert', takedownError);
  }

  // Solo se oculta si quien lo pide tiene autoridad sobre la publicación.
  if (canHide) {
    const { error: hideError } = await supabaseAdmin
      .from('publications')
      .update({ status: 'HIDDEN' })
      .eq('id', publication_id);

    if (hideError) {
      return internalError(res, 'takedown/hide', hideError);
    }
  }

  const audited = await writeAuditLog(supabaseAdmin, {
    actorProfileId: actor.id,
    action: canHide ? 'TAKEDOWN_REQUESTED_AND_HIDDEN' : 'TAKEDOWN_REQUESTED',
    entityType: 'publication',
    entityId: publication_id,
    metadata: {
      takedown_request_id: takedown.id,
      reason,
      publication_slug: publication.slug,
      auto_hidden: canHide,
      requested_by_role: actor.role,
    },
  });

  if (publication.ownerProfileId === actor.id || actor.role === 'ADMIN') {
    // El dueño y los admins ven si la auditoría falló: es información relevante.
    if (!audited) {
      return fail(
        res,
        500,
        'INTERNAL',
        'La solicitud se registró pero no se pudo auditar. Avisa al equipo.'
      );
    }
  }

  return json(res, 201, {
    success: true,
    takedown_id: takedown.id,
    auto_hidden: canHide,
    message: canHide
      ? 'Solicitud registrada. La publicación se ha ocultado pendiente de revisión.'
      : 'Solicitud registrada. Un moderador la revisará y decidirá si se retira el contenido.',
    publication: {
      id: publication.id,
      slug: publication.slug,
    },
  });
}
