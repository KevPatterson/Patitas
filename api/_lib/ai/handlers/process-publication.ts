import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../../../_types/vercel.js';
import { supabaseAdmin } from '../../supabase-admin.js';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../../http.js';
import { limitAiByUser, limitByIp } from '../../rate-limit-utils.js';
import { canManagePublication, getActor, loadPublication } from '../../authz.js';
import { AI_ENABLED } from '../../env.js';
import { runAIJob, type AIJobRow } from '../job-runner.js';

/**
 * POST /api/ai?action=process-publication — analiza una publicación con IA.
 *
 * El proyecto no tiene worker ni cron que consuma `ai_processing_jobs`, así que
 * encolar los trabajos y responder 200 dejaba al usuario esperando un estado
 * que nunca cambiaba. Ahora los trabajos se ejecutan en la misma petición y la
 * respuesta incluye el resultado de cada uno.
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

  const tasks =
    parsed.data.tasks && parsed.data.tasks.length > 0
      ? parsed.data.tasks
      : (['embedding_text', 'moderation'] as const);

  // Reutilizar trabajos que ya estaban en cola (de clics anteriores) en vez de
  // acumular duplicados que nunca se procesarían.
  const { data: pendingJobs, error: pendingError } = await supabaseAdmin
    .from('ai_processing_jobs')
    .select('*')
    .eq('publication_id', publication.id)
    .eq('status', 'PENDING')
    .in('job_type', tasks);

  if (pendingError) {
    return internalError(res, 'ai/process-publication', pendingError);
  }

  const pendingByType = new Map<string, AIJobRow>();
  const duplicateIds: string[] = [];

  for (const row of (pendingJobs ?? []) as AIJobRow[]) {
    if (pendingByType.has(row.job_type)) {
      duplicateIds.push(row.id);
    } else {
      pendingByType.set(row.job_type, row);
    }
  }

  if (duplicateIds.length > 0) {
    await supabaseAdmin
      .from('ai_processing_jobs')
      .update({ status: 'CANCELLED', completed_at: new Date().toISOString() })
      .in('id', duplicateIds);
  }

  const missingTasks = tasks.filter((task) => !pendingByType.has(task));

  if (missingTasks.length > 0) {
    const jobs = missingTasks.map((task) => ({
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
      .select('*');

    if (jobError) {
      return internalError(res, 'ai/process-publication', jobError);
    }

    for (const row of (createdJobs ?? []) as AIJobRow[]) {
      pendingByType.set(row.job_type, row);
    }
  }

  // Orden estable según lo pedido, procesando uno detrás de otro.
  const jobsToRun = tasks
    .map((task) => pendingByType.get(task))
    .filter((job): job is AIJobRow => Boolean(job));

  const results: Array<{ id: string; job_type: string; status: string; error?: string }> = [];
  let completed = 0;
  let failed = 0;

  for (const job of jobsToRun) {
    // Sin worker que reintente, un fallo se marca como definitivo y el usuario
    // puede volver a intentarlo con el botón.
    const outcome = await runAIJob(job, { allowRetry: false });

    if (outcome.ok) {
      completed += 1;
    } else {
      failed += 1;
    }

    results.push({
      id: job.id,
      job_type: job.job_type,
      status: outcome.status,
      error: outcome.error,
    });
  }

  return json(res, 200, {
    ok: true,
    message: failed === 0 ? 'Análisis completado' : 'Análisis completado con errores',
    jobs: results,
    completed,
    failed,
  });
}
