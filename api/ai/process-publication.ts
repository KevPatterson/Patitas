import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from '../_lib/rate-limit-utils';

/**
 * Endpoint para iniciar procesamiento asíncrono de IA en una publicación
 * POST /api/ai/process-publication
 * 
 * Body: {
 *   publicationId: string;
 *   tasks?: Array<'ocr' | 'vision' | 'embedding_text' | 'embedding_image' | 'moderation' | 'extraction'>;
 * }
 * 
 * Crea jobs de procesamiento asíncrono que serán procesados posteriormente
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 20 procesamiento AI por hora
  if (!checkRateLimit(req, res, 'ai-process', 20, 3600_000)) {
    return;
  }

  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);

  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Unauthorized' });
  }

  let payload: { publicationId?: string; tasks?: string[] } = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!payload.publicationId) {
    return res.status(400).json({ error: 'Missing publicationId' });
  }

  // Verificar que la publicación existe y pertenece al usuario
  const { data: publication, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, owner_profile_id')
    .eq('id', payload.publicationId)
    .is('deleted_at', null)
    .single();

  if (pubError || !publication) {
    return res.status(404).json({ error: 'Publication not found' });
  }

  if (publication.owner_profile_id !== user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Tareas por defecto si no se especifican
  const tasks = payload.tasks && payload.tasks.length > 0 
    ? payload.tasks 
    : ['embedding_text', 'moderation'];

  const validTasks = ['ocr', 'vision', 'embedding_text', 'embedding_image', 'moderation', 'extraction'];
  const filteredTasks = tasks.filter((t) => validTasks.includes(t));

  if (filteredTasks.length === 0) {
    return res.status(400).json({ error: 'No valid tasks specified' });
  }

  // Crear jobs de procesamiento
  const jobs = filteredTasks.map((task) => ({
    publication_id: payload.publicationId,
    job_type: task,
    status: 'PENDING',
    priority: task === 'moderation' ? 1 : 5,
    retry_count: 0,
    max_retries: 3,
    metadata: {},
  }));

  const { data: createdJobs, error: jobError } = await supabaseAdmin
    .from('ai_processing_jobs')
    .insert(jobs)
    .select('id, job_type');

  if (jobError) {
    console.error('Error creating AI jobs:', jobError);
    return res.status(500).json({ error: 'Failed to create processing jobs' });
  }

  return res.status(200).json({ 
    ok: true, 
    message: 'AI processing jobs created',
    jobs: createdJobs,
  });
}
