import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../../../_types/vercel.js';
import { supabaseAdmin } from '../../supabase-admin.js';
import { fail, parseBody, rejectMethod } from '../../http.js';
import { limitByIp } from '../../rate-limit-utils.js';
import { AI_ENABLED, INTERNAL_API_KEY } from '../../env.js';
import { safeEqual } from '../../authz.js';
import { isRunnableJob, runAIJob, type AIJobRow } from '../job-runner.js';

/**
 * POST /api/ai?action=process-job — procesa un job de IA concreto. Lo invoca el
 * worker/cron, nunca el navegador.
 *
 * Hallazgo API-09: la API key se comparaba con `authHeader !== \`Bearer ${apiKey}\``,
 * una comparación que corta en el primer byte distinto y por tanto filtra
 * información por temporización. Ahora se usa una comparación de tiempo constante.
 *
 * El body además se valida con Zod. La ejecución del job vive en `job-runner`,
 * compartida con `process-publication` (que los ejecuta en línea).
 */

const processJobSchema = z.object({
  jobId: z.string().uuid('El identificador del job no es válido'),
});

export async function handleProcessJob(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'process-job-ip', 120, 60_000);
  if (!ipLimit.ok) return;

  // Autorización interna con comparación de tiempo constante.
  const apiKey = INTERNAL_API_KEY;
  const authHeader = req.headers.authorization ?? '';
  const expected = apiKey ? `Bearer ${apiKey}` : '';

  if (!apiKey || !safeEqual(authHeader, expected)) {
    return fail(res, 401, 'UNAUTHORIZED', 'No autorizado');
  }

  if (!AI_ENABLED) {
    return fail(res, 503, 'INTERNAL', 'El procesamiento con IA está desactivado');
  }

  const parsed = parseBody(req, processJobSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const jobId = parsed.data.jobId;

  // Obtener el job
  const { data: job, error: jobError } = await supabaseAdmin
    .from('ai_processing_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return fail(res, 404, 'NOT_FOUND', 'Job no encontrado');
  }

  // Verificar que el job esté pendiente o en estado de reintento
  if (!isRunnableJob(job)) {
    return fail(res, 409, 'CONFLICT', `El job está en estado ${job.status} y no se puede procesar`);
  }

  const outcome = await runAIJob(job as AIJobRow);

  if (outcome.ok) {
    return res.status(200).json({
      ok: true,
      jobId: outcome.jobId,
      status: outcome.status,
      processingTime: outcome.processingTime,
      result: outcome.result,
    });
  }

  return res.status(500).json({
    ok: false,
    error: outcome.error,
    jobId: outcome.jobId,
    willRetry: outcome.willRetry,
    retryCount: outcome.retryCount,
  });
}
