import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../types/vercel.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../_lib/http.js';
import { limitByIp, limitByUser } from '../_lib/rate-limit-utils.js';
import { getActorRole, isModerator, writeAuditLog, type Role } from '../_lib/authz.js';

/**
 * POST /api/admin/moderation — acciones de moderación.
 *
 * Lo que YA estaba bien (y se conserva): el JWT se valida con
 * `supabase.auth.getUser` y el rol se lee de `profiles` con el service role,
 * nunca de `user_metadata` ni de claims del token (que el usuario puede editar).
 *
 * Lo que faltaba (hallazgo API-01):
 *   - Zod: solo se comprobaba presencia de `action` e `id`. `id` nunca se
 *     validaba como UUID y no existía `reason` con longitud máxima.
 *   - Los errores de Postgres se devolvían al cliente (hallazgo API-08).
 *   - El resultado del `insert` en `audit_logs` se ignoraba: si fallaba, la
 *     acción se aplicaba sin dejar rastro.
 */

const moderationSchema = z
  .object({
    action: z.enum([
      'resolve-report',
      'hide-publication',
      'restore-publication',
      'set-role',
      'approve-takedown',
      'reject-takedown',
      'approve-import',
      'reject-import',
    ]),
    id: z.string().uuid('El identificador no es válido'),
    reason: z
      .string()
      .trim()
      .min(3, 'El motivo es demasiado corto')
      .max(500, 'El motivo es demasiado largo (máximo 500 caracteres)')
      .optional(),
    role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
  })
  .refine((data) => data.action !== 'set-role' || data.role !== undefined, {
    message: 'Para cambiar el rol hay que indicar el nuevo rol',
    path: ['role'],
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'moderation-ip', 40, 60_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const role = await getActorRole(supabaseAdmin, auth.user.id);

  if (!isModerator(role ? { id: auth.user.id, role } : null)) {
    return fail(res, 403, 'FORBIDDEN', 'No tienes permisos de moderación');
  }

  const userLimit = await limitByUser(res, 'moderation-user', auth.user.id, 30, 60_000);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, moderationSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const { action, id, reason, role: newRole } = parsed.data;

  // Toda acción de moderación debe quedar auditada. Si la auditoría falla, la
  // acción NO se aplica: antes se ejecutaba y el fallo se perdía.
  const audit = async (entityType: string, metadata: Record<string, unknown>): Promise<boolean> =>
    writeAuditLog(supabaseAdmin, {
      actorProfileId: auth.user.id,
      action,
      entityType,
      entityId: id,
      metadata: { ...metadata, reason: reason ?? null, moderator_role: role },
    });

  if (action === 'resolve-report') {
    const { error } = await supabaseAdmin
      .from('reports')
      .update({
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
        resolved_by: auth.user.id,
      })
      .eq('id', id);

    if (error) {
      return internalError(res, 'moderation/resolve-report', error);
    }

    const audited = await audit('report', {});

    return json(res, 200, { ok: true, audited });
  }

  if (action === 'hide-publication' || action === 'restore-publication') {
    const nextStatus = action === 'hide-publication' ? 'HIDDEN' : 'ACTIVE';

    const { error } = await supabaseAdmin
      .from('publications')
      .update({ status: nextStatus })
      .eq('id', id);

    if (error) {
      return internalError(res, 'moderation/publication-status', error);
    }

    const audited = await audit('publication', { next_status: nextStatus });

    return json(res, 200, { ok: true, status: nextStatus, audited });
  }

  if (action === 'set-role') {
    if (role !== 'ADMIN') {
      return fail(res, 403, 'FORBIDDEN', 'Solo un administrador puede cambiar roles');
    }

    const targetRole = newRole as Role;

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: targetRole })
      .eq('id', id);

    if (error) {
      return internalError(res, 'moderation/set-role', error);
    }

    const audited = await audit('profile', { new_role: targetRole });

    return json(res, 200, { ok: true, role: targetRole, audited });
  }

  if (action === 'approve-import' || action === 'reject-import') {
    // `id` es el id de un external_post (la cola de revisión de importaciones).
    // Complementa el cierre de Fase 1: las importaciones sin auto-publicar nacen
    // HIDDEN y solo un moderador las hace públicos (o las elimina) desde aquí.
    const { data: post, error: postError } = await supabaseAdmin
      .from('external_posts')
      .select('id, publication_id, source_id')
      .eq('id', id)
      .maybeSingle();

    if (postError) {
      return internalError(res, 'moderation/import-read', postError);
    }

    if (!post) {
      return fail(res, 404, 'NOT_FOUND', 'Post externo no encontrado');
    }

    const approving = action === 'approve-import';

    const { error: updatePostError } = await supabaseAdmin
      .from('external_posts')
      .update({ status: approving ? 'PUBLISHED' : 'REJECTED' })
      .eq('id', id);

    if (updatePostError) {
      return internalError(res, 'moderation/import-update', updatePostError);
    }

    if (post.publication_id) {
      const publicationUpdate = approving
        ? { status: 'ACTIVE', import_review_status: 'MANUAL_APPROVED' }
        : { status: 'DELETED', deleted_at: new Date().toISOString(), import_review_status: 'REJECTED' };

      const { error: pubError } = await supabaseAdmin
        .from('publications')
        .update(publicationUpdate)
        .eq('id', post.publication_id);

      if (pubError) {
        return internalError(res, 'moderation/import-publication', pubError);
      }
    }

    const audited = await audit('external_post', {
      source_id: post.source_id,
      publication_id: post.publication_id,
      decision: approving ? 'APPROVED' : 'REJECTED',
    });

    return json(res, 200, {
      ok: true,
      audited,
      message: approving
        ? 'Importación aprobada. La publicación ya es visible.'
        : 'Importación rechazada. La publicación se ha eliminado.',
    });
  }

  if (action === 'approve-takedown' || action === 'reject-takedown') {
    const { data: takedown, error: takedownError } = await supabaseAdmin
      .from('takedown_requests')
      .select('id, publication_id, reason, previous_status')
      .eq('id', id)
      .maybeSingle();

    if (takedownError) {
      return internalError(res, 'moderation/takedown-read', takedownError);
    }

    if (!takedown) {
      return fail(res, 404, 'NOT_FOUND', 'Solicitud de retirada no encontrada');
    }

    const approving = action === 'approve-takedown';

    const { error: updateRequestError } = await supabaseAdmin
      .from('takedown_requests')
      .update({
        status: approving ? 'APPROVED' : 'REJECTED',
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
        ...(reason ? { review_notes: reason } : {}),
      })
      .eq('id', id);

    if (updateRequestError) {
      return internalError(res, 'moderation/takedown-update', updateRequestError);
    }

    // Aprobar = eliminar definitivamente. Rechazar = restaurar el estado previo.
    const publicationUpdate = approving
      ? { status: 'DELETED', deleted_at: new Date().toISOString() }
      : { status: (takedown.previous_status as string | null) ?? 'ACTIVE' };

    const { error: pubError } = await supabaseAdmin
      .from('publications')
      .update(publicationUpdate)
      .eq('id', takedown.publication_id);

    if (pubError) {
      return internalError(res, 'moderation/takedown-publication', pubError);
    }

    if (takedown.publication_id) {
      await supabaseAdmin
        .from('external_posts')
        .update({ status: approving ? 'TAKEN_DOWN' : 'PUBLISHED' })
        .eq('publication_id', takedown.publication_id);
    }

    const audited = await audit('takedown_request', {
      publication_id: takedown.publication_id,
      takedown_reason: takedown.reason,
      decision: approving ? 'APPROVED' : 'REJECTED',
    });

    return json(res, 200, {
      ok: true,
      audited,
      message: approving
        ? 'Solicitud aprobada. La publicación se ha eliminado.'
        : 'Solicitud rechazada. La publicación se ha restaurado.',
    });
  }

  // Inalcanzable: el enum de Zod ya limita las acciones.
  return fail(res, 400, 'INVALID_INPUT', 'Acción no reconocida');
}
