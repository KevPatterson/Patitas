import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../../_types/vercel.js';
import { supabaseAdmin } from '../supabase-admin.js';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../http.js';
import { limitByIp, limitByUser } from '../rate-limit-utils.js';
import { getActorRole, isModerator, writeAuditLog } from '../authz.js';

/**
 * GET/POST /api/admin?resource=verifications
 *
 * Cola de verificación de perfiles. Vive en la API y no en el cliente porque la
 * evidencia (URL y notas) no tiene SELECT para `authenticated`: puede contener
 * documentos personales. El service role es el único que la lee.
 *
 * GET  -> lista las solicitudes de un estado (por defecto PENDING).
 * POST -> aprueba o rechaza una solicitud y deja rastro en `audit_logs`.
 */

const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

const reviewSchema = z.object({
  id: z.string().uuid('El identificador no es válido'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z
    .string()
    .trim()
    .min(3, 'El motivo es demasiado corto')
    .max(500, 'El motivo es demasiado largo (máximo 500 caracteres)')
    .optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'INVALID_INPUT', 'Método no permitido. Usa GET o POST.');
  }

  const ipLimit = await limitByIp(req, res, 'verifications-ip', 60, 60_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const role = await getActorRole(supabaseAdmin, auth.user.id);

  if (!isModerator(role ? { id: auth.user.id, role } : null)) {
    return fail(res, 403, 'FORBIDDEN', 'No tienes permisos de moderación');
  }

  const userLimit = await limitByUser(res, 'verifications-user', auth.user.id, 60, 60_000);
  if (!userLimit.ok) return;

  if (req.method === 'GET') {
    const parsed = listQuerySchema.safeParse({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });

    if (!parsed.success) {
      return fail(res, 400, 'INVALID_INPUT', 'Estado de verificación no válido');
    }

    const status = parsed.data.status ?? 'PENDING';

    const { data, error } = await supabaseAdmin
      .from('profile_verifications')
      .select(
        `id, profile_id, kind, status, evidence_url, note, review_notes, reviewed_at, created_at,
         profile:profiles!profile_id(id, username, full_name, avatar_url)`
      )
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      return internalError(res, 'verifications/list', error);
    }

    const items = (data ?? []).map((item) => ({
      ...item,
      profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile,
    }));

    return json(res, 200, { items, status });
  }

  if (rejectMethod(req, res, 'POST')) return;

  const parsed = parseBody(req, reviewSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const { id, decision, reason } = parsed.data;

  if (decision === 'REJECTED' && !reason) {
    return fail(res, 400, 'INVALID_INPUT', 'Indica el motivo del rechazo');
  }

  const { data: verification, error: readError } = await supabaseAdmin
    .from('profile_verifications')
    .select('id, profile_id, kind, status')
    .eq('id', id)
    .maybeSingle();

  if (readError) {
    return internalError(res, 'verifications/read', readError);
  }

  if (!verification) {
    return fail(res, 404, 'NOT_FOUND', 'Solicitud de verificación no encontrada');
  }

  if (verification.status !== 'PENDING') {
    return fail(res, 409, 'CONFLICT', 'Esta solicitud ya fue revisada');
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('profile_verifications')
    .update({
      status: decision,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reason ?? null,
    })
    .eq('id', id)
    .eq('status', 'PENDING')
    .select('id')
    .maybeSingle();

  if (updateError) {
    return internalError(res, 'verifications/update', updateError);
  }

  // Otra persona pudo revisarla entre la lectura y la escritura.
  if (!updated) {
    return fail(res, 409, 'CONFLICT', 'Esta solicitud ya fue revisada');
  }

  const audited = await writeAuditLog(supabaseAdmin, {
    actorProfileId: auth.user.id,
    action: decision === 'APPROVED' ? 'approve-verification' : 'reject-verification',
    entityType: 'profile_verification',
    entityId: id,
    metadata: {
      profile_id: verification.profile_id,
      kind: verification.kind,
      decision,
      reason: reason ?? null,
      moderator_role: role,
    },
  });

  return json(res, 200, { ok: true, status: decision, audited });
}
