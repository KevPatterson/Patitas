import type { VercelRequest, VercelResponse } from './types/vercel';

/**
 * GET /api/ping — diagnóstico mínimo de las Vercel Functions.
 *
 * No importa nada en tiempo de ejecución a propósito: sirve para distinguir un
 * fallo del runtime (o del despliegue) de un fallo de los módulos compartidos.
 * Se elimina cuando termine el diagnóstico.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
  });
}
