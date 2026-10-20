import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../../../types/vercel.js';
import { supabaseAdmin } from '../../supabase-admin.js';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../../http.js';
import { limitAiByUser, limitByIp } from '../../rate-limit-utils.js';
import { canManagePublication, getActor, loadPublication } from '../../authz.js';
import { AI_ENABLED } from '../../env.js';

/**
 * POST /api/ai?action=process-publication — encola trabajos de IA para una publicación.
 *
 * Ya comprobaba la propiedad y devolvía 403, pero no contemplaba al moderador
 * (le bloqueaba igual) y el body se validaba a mano. Se completa con Zod y se
 * aplica cuota por usuario.
 */

const VALID_TASKS = [
  'ocr',
  'vision',
  'embedding_text',
  'embedding_image',
  'moderation',
  'extraction',
] as const;

const processSchema = z.object({
  publicationId: z.string().uuid('El identificador de la publicación no es válido'),
  tasks: z.array(z.enum(VALID_TASKS)).max(VALID_TASKS.length).optional(),
});

export async function handleProcessPublication(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'ai-process-ip', 60, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const userLimit = await limitAiByUser(res, auth.user.id);
  if (!userLimit.ok) return;

  if (!AI_ENABLED) {
    return fail(res, 503, 'INTERNAL', 'El procesamiento con IA está desactivado temporalmente.');
  }

  const parsed = parseBody(req, processSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const publication = await loadPublication(supabaseAdmin, parsed.data.publicationId);

  if (!publication) {
    return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
  }

  const actor = await getActor(supabaseAdmin, auth.user.id);

  if (!canManagePublication(actor, publication)) {
    return fail(res, 403, 'FORBIDDEN', 'No tienes permiso sobre esta publicación');
  }

  const tasks = parsed.data.tasks && parsed.data.tasks.length > 0
    ? parsed.data.tasks
    : (['embedding_text', 'moderation'] as const);

  const jobs = tasks.map((task: string) => ({
    publication_id: publication.id,
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
    return internalError(res, 'ai/process-publication', jobError);
  }

  return json(res, 200, {
    ok: true,
    message: 'Trabajos de IA encolados',
    jobs: createdJobs,
  });
}