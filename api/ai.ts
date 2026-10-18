import type { VercelRequest, VercelResponse } from './types/vercel';
import { rejectMethod } from './_lib/http';
import { AI_ENABLED, providerAvailable } from './_lib/env';

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
      return (await import('./ai/calculate-matches')).default(req, res);
    case 'create-match':
      return (await import('./ai/create-match')).default(req, res);
    case 'detect-duplicates':
      return (await import('./ai/detect-duplicates')).default(req, res);
    case 'extract-from-image':
      return (await import('./ai/extract-from-image')).default(req, res);
    case 'process-publication':
      return (await import('./ai/process-publication')).default(req, res);
    case 'process-job':
      return (await import('./ai/process-job')).default(req, res);
    default:
      return res.status(400).json({ error: 'Acción desconocida', code: 'INVALID_INPUT' });
  }
}
