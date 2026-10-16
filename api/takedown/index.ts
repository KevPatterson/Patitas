import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from '../_lib/rate-limit-utils';

const TAKEDOWN_REASONS = ['COPYRIGHT', 'PRIVACY', 'INACCURATE', 'OTHER'] as const;
type TakedownReason = typeof TAKEDOWN_REASONS[number];

function json(res: VercelResponse, statusCode: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  
  // Rate limiting: 5 solicitudes por hora por IP
  if (!checkRateLimit(req, res, 'takedown-create', 5, 3600_000)) {
    return;
  }
  
  // No requerimos autenticación obligatoria - cualquiera puede solicitar retirada
  // Pero si hay token, validamos
  const token = extractToken(req);
  let userId: string | null = null;
  
  if (token) {
    const { user, error: authError } = await verifyAuth(token, supabaseAdmin);
    if (!authError && user) {
      userId = user.id;
    }
  }
  
  let payload: Partial<{ 
    publication_id: string; 
    reason: TakedownReason; 
    contact_email?: string;
    details?: string;
  }> = {};
  
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }
  
  // Validaciones
  if (!payload.publication_id) {
    return json(res, 400, { error: 'publication_id requerido' });
  }
  
  if (!payload.reason || !TAKEDOWN_REASONS.includes(payload.reason)) {
    return json(res, 400, { error: 'Motivo inválido. Permitidos: COPYRIGHT, PRIVACY, INACCURATE, OTHER' });
  }
  
  if (payload.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact_email)) {
    return json(res, 400, { error: 'Email de contacto inválido' });
  }
  
  // Verificar que la publicación existe y está publicada
  const { data: publication, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, slug, title, status, is_imported, source_url, owner_profile_id')
    .eq('id', payload.publication_id)
    .is('deleted_at', null)
    .single();
  
  if (pubError || !publication) {
    return json(res, 404, { error: 'Publicación no encontrada' });
  }
  
  if (publication.status !== 'ACTIVE' && publication.status !== 'RESOLVED') {
    return json(res, 400, { error: 'La publicación no está activa' });
  }
  
  // Verificar si ya hay una solicitud pendiente para esta publicación
  const { data: existingRequest } = await supabaseAdmin
    .from('takedown_requests')
    .select('id, status')
    .eq('publication_id', payload.publication_id)
    .eq('status', 'PENDING')
    .maybeSingle();
  
  if (existingRequest) {
    return json(res, 409, { error: 'Ya existe una solicitud de retirada pendiente para esta publicación' });
  }
  
  // Crear solicitud de retirada (guardar previous_status en la propia solicitud)
  const { data: takedown, error: takedownError } = await supabaseAdmin
    .from('takedown_requests')
    .insert({
      publication_id: payload.publication_id,
      reason: payload.reason,
      contact_email: payload.contact_email ?? null,
      status: 'PENDING',
      review_notes: payload.details ?? null,
      previous_status: publication.status,
    })
    .select('id, created_at')
    .single();

  if (takedownError || !takedown) {
    console.error('Error creando takedown request:', takedownError);
    return json(res, 500, { error: 'Error creando solicitud' });
  }

  // OCULTAR LA PUBLICACIÓN INMEDIATAMENTE (cambiar status a HIDDEN)
  await supabaseAdmin
    .from('publications')
    .update({ 
      status: 'HIDDEN',
    })
    .eq('id', payload.publication_id);
  
  // Registrar en audit_logs
  await supabaseAdmin.from('audit_logs').insert({
    action: 'TAKEDOWN_REQUESTED',
    entity_type: 'publication',
    entity_id: payload.publication_id,
    metadata: {
      takedown_request_id: takedown.id,
      reason: payload.reason,
      requested_by_user_id: userId,
      contact_email: payload.contact_email ?? null,
      publication_slug: publication.slug,
      was_imported: publication.is_imported,
      source_url: publication.source_url,
    },
  });
  
  // Si es una publicación importada, actualizar external_posts
  if (publication.is_imported) {
    await supabaseAdmin
      .from('external_posts')
      .update({ status: 'TAKEN_DOWN' })
      .eq('publication_id', payload.publication_id);
  }
  
  return json(res, 201, {
    success: true,
    takedown_id: takedown.id,
    message: 'Solicitud de retirada creada. La publicación ha sido ocultada pendiente de revisión.',
    publication: {
      id: publication.id,
      slug: publication.slug,
      title: publication.title,
    },
  });
}