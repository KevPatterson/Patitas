import type { VercelRequest, VercelResponse } from './types/vercel';
import { rejectMethod } from './_lib/http';
import { AI_ENABLED, providerAvailable } from './_lib/env';
import { handleCalculateMatches } from './_lib/ai/handlers/calculate-matches';
import { handleCreateMatch } from './_lib/ai/handlers/create-match';
import { handleDetectDuplicates } from './_lib/ai/handlers/detect-duplicates';
import { handleExtractFromImage } from './_lib/ai/handlers/extract-from-image';
import { handleProcessPublication } from './_lib/ai/handlers/process-publication';
import { handleProcessJob } from './_lib/ai/handlers/process-job';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

/**
 * POST /api/ai?action=<action> — router de los handlers de IA.
 *
 * Se añade la comprobación de método explícita (antes respondía a cualquier
 * verbo y delegaba) y, sobre todo, la puerta única de `AI_ENABLED`: mientras la
 * IA esté desactivada no se ejecuta ningún handler, así que la UI nunca puede
 * presentar resultados del proveedor mock como si fueran reales.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const rawAction = req.query.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction;

  if (!action) {
    return res.status(400).json({
      error: 'Falta el parámetro action',
      code: 'INVALID_INPUT',
      allowed: [
        'calculate-matches',
        'create-match',
        'detect-duplicates',
        'extract-from-image',
        'process-publication',
        'process-job',
      ],
    });
  }

  if (!AI_ENABLED) {
    return res.status(503).json({
      error: 'Las funciones de IA están desactivadas temporalmente',
      code: 'AI_DISABLED',
    });
  }

  // El proveedor por defecto del repo (TESSERACT) no está instalado: mejor un
  // 503 claro que un error de importación a mitad del handler (hallazgo AI-01).
  const provider = providerAvailable();

  if (!provider.ok) {
    return res.status(503).json({
      error: provider.reason,
      code: 'AI_PROVIDER_UNAVAILABLE',
    });
  }

  switch (action) {
    case 'calculate-matches':
      return handleCalculateMatches(req, res);
    case 'create-match':
      return handleCreateMatch(req, res);
    case 'detect-duplicates':
      return handleDetectDuplicates(req, res);
    case 'extract-from-image':
      return handleExtractFromImage(req, res);
    case 'process-publication':
      return handleProcessPublication(req, res);
    case 'process-job':
      return handleProcessJob(req, res);
    default:
      return res.status(400).json({ error: 'Acción desconocida', code: 'INVALID_INPUT' });
  }
}
