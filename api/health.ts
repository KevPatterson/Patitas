import type { VercelRequest, VercelResponse } from './types/vercel';
import { IS_PRODUCTION } from './_lib/env.js';

/**
 * GET /api/health — diagnóstico temporal del runtime.
 *
 * No importa módulos en tiempo de ejecución para distinguir un fallo del
 * runtime (o del bundle) de un fallo de `_lib`. Se restaura en cuanto se
 * identifique la causa.
 */
export default function handler(_req: VercelRequest, res?: VercelResponse) {
  const payload = {
    ok: true,
    hasProcess: typeof globalThis.process,
    hasRes: Boolean(res),
    isProduction: IS_PRODUCTION,
  };

  if (res && typeof res.status === 'function') {
    return res.status(200).json(payload);
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
