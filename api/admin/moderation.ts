import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { consumeRateLimit } from '../_lib/rate-limit';

type ModerationAction = 
  | 'resolve-report' 
  | 'hide-publication' 
  | 'restore-publication' 
  | 'set-role'
  | 'approve-takedown'
  | 'reject-takedown';

function json(res: VercelResponse, statusCode: number, body: Record<string, unknown>) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown';
  const rateKey = `moderation:${ip}`;
  const rate = consumeRateLimit(rateKey, 20, 60_000);

  if (!rate.allowed) {
    res.setHeader('Retry-After', Math.ceil((rate.resetAt - Date.now()) / 1000).toString());
    return json(res, 429, { error: 'Too many requests' });
  }

  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return json(res, 401, { error: 'Missing authorization token' });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return json(res, 401, { error: 'Invalid session' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile || (profile.role !== 'MODERATOR' && profile.role !== 'ADMIN')) {
    return json(res, 403, { error: 'Forbidden' });
  }

  let payload: { action?: ModerationAction; id?: string; role?: string } = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as typeof payload);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  if (!payload.action || !payload.id) {
    return json(res, 400, { error: 'Missing action or id' });
  }

  if (payload.action === 'resolve-report') {
    const { error } = await supabaseAdmin
      .from('reports')
      .update({
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
        resolved_by: userData.user.id,
      })
      .eq('id', payload.id);

    if (error) {
      return json(res, 500, { error: error.message });
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_profile_id: userData.user.id,
      action: 'resolve-report',
      entity_type: 'report',
      entity_id: payload.id,
      metadata: {},
    });

    return json(res, 200, { ok: true });
  }

  if (payload.action === 'hide-publication' || payload.action === 'restore-publication') {
    const nextStatus = payload.action === 'hide-publication' ? 'HIDDEN' : 'ACTIVE';

    const { error } = await supabaseAdmin.from('publications').update({ status: nextStatus }).eq('id', payload.id);

    if (error) {
      return json(res, 500, { error: error.message });
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_profile_id: userData.user.id,
      action: payload.action,
      entity_type: 'publication',
      entity_id: payload.id,
      metadata: {},
    });

    return json(res, 200, { ok: true });
  }

  if (payload.action === 'set-role') {
    if (profile.role !== 'ADMIN') {
      return json(res, 403, { error: 'Only admins can change roles' });
    }

    const newRole = payload.role as 'USER' | 'MODERATOR' | 'ADMIN';
    if (!newRole || !['USER', 'MODERATOR', 'ADMIN'].includes(newRole)) {
      return json(res, 400, { error: 'Invalid role' });
    }

    const { error } = await supabaseAdmin.from('profiles').update({ role: newRole }).eq('id', payload.id);

    if (error) {
      return json(res, 500, { error: error.message });
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_profile_id: userData.user.id,
      action: 'set-role',
      entity_type: 'profile',
      entity_id: payload.id,
      metadata: { newRole },
    });

    return json(res, 200, { ok: true, role: newRole });
  }

  if (payload.action === 'approve-takedown') {
    // Aprobar solicitud: marcar publicación como DELETED permanentemente
    const { data: takedown, error: takedownError } = await supabaseAdmin
      .from('takedown_requests')
      .select('id, publication_id, reason')
      .eq('id', payload.id)
      .single();

    if (takedownError || !takedown) {
      return json(res, 404, { error: 'Solicitud no encontrada' });
    }

    // Actualizar solicitud
    await supabaseAdmin
      .from('takedown_requests')
      .update({
        status: 'APPROVED',
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', payload.id);

    // Marcar publicación como DELETED
    await supabaseAdmin
      .from('publications')
      .update({
        status: 'DELETED',
        deleted_at: new Date().toISOString(),
      })
      .eq('id', takedown.publication_id);

    // Actualizar external_posts si es importada
    await supabaseAdmin
      .from('external_posts')
      .update({ status: 'TAKEN_DOWN' })
      .eq('publication_id', takedown.publication_id);

    await supabaseAdmin.from('audit_logs').insert({
      actor_profile_id: userData.user.id,
      action: 'TAKEDOWN_APPROVED',
      entity_type: 'takedown_request',
      entity_id: payload.id,
      metadata: { publication_id: takedown.publication_id, reason: takedown.reason },
    });

    return json(res, 200, { ok: true, message: 'Solicitud aprobada. Publicación eliminada.' });
  }


  if (payload.action === 'reject-takedown') {
    // Rechazar solicitud: restaurar publicación si estaba oculta
    const { data: takedown, error: takedownError } = await supabaseAdmin
      .from('takedown_requests')
      .select('id, publication_id, previous_status, review_notes')
      .eq('id', payload.id)
      .single();

    if (takedownError || !takedown) {
      return json(res, 404, { error: 'Solicitud no encontrada' });
    }

    const previousStatus = takedown.previous_status ?? 'ACTIVE';

    // Actualizar solicitud
    await supabaseAdmin
      .from('takedown_requests')
      .update({
        status: 'REJECTED',
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', payload.id);

    // Restaurar publicación
    await supabaseAdmin
      .from('publications')
      .update({
        status: previousStatus,
      })
      .eq('id', takedown.publication_id);


    // Actualizar external_posts si es importada
    await supabaseAdmin
      .from('external_posts')
      .update({ status: 'PUBLISHED' })
      .eq('publication_id', takedown.publication_id);

    await supabaseAdmin.from('audit_logs').insert({
      actor_profile_id: userData.user.id,
      action: 'TAKEDOWN_REJECTED',
      entity_type: 'takedown_request',
      entity_id: payload.id,
      metadata: { publication_id: takedown.publication_id },
    });

    return json(res, 200, { ok: true, message: 'Solicitud rechazada. Publicación restaurada.' });
  }

  return json(res, 400, { error: 'Unknown action' });
}