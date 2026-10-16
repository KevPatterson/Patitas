import type { VercelRequest, VercelResponse } from './types/vercel';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

/**
 * Endpoint unificado de IA - Enruta a las subfunciones específicas
 * POST /api/ai?action=<action>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action as string;

  // Enrutar a los handlers originales manteniendo compatibilidad
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
      return res.status(400).json({ error: 'Unknown action. Use ?action=<action>' });
  }
}
