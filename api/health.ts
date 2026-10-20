import type { VercelRequest, VercelResponse } from './types/vercel.js';
import { IS_PRODUCTION } from './_lib/env.js';

/**
 * GET /api/health — health check.
 *
 * Hallazgo API-08: este endpoint es público y devolvía `error.message` de
 * Postgres/Supabase, lo que expone nombres de tablas, columnas y políticas. Ahora
 * solo responde `ok`/`error` y el detalle se registra en los logs del servidor.
 *
 * Se añade también la comprobación de método, que no existía: respondía a
 * cualquier verbo.
 *
 * Supabase se importa de forma dinámica para que un fallo al cargar sus
 * dependencias no tumbe el endpoint: se informa como `degraded` en vez de
 * devolver un 500 sin cuerpo.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Método no permitido', code: 'INVALID_INPUT' });
  }

  const checks: Record<string, { status: 'ok' | 'error' }> = {
    api: { status: 'ok' },
    database: { status: 'ok' },
    storage: { status: 'ok' },
  };

  let overallStatus = 'ok';

  // Base de datos: solo se informa del estado, nunca del error.
  try {
    const { supabaseAdmin } = await import('./_lib/supabase-admin.js');
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1).maybeSingle();

    if (error) {
      console.error('[health] base de datos no responde', error);
      checks.database.status = 'error';
      overallStatus = 'degraded';
    }
  } catch (error) {
    console.error('[health] excepción en base de datos', error);
    checks.database.status = 'error';
    overallStatus = 'degraded';
  }

  // Storage
  try {
    const { supabaseAdmin } = await import('./_lib/supabase-admin.js');
    const { data, error } = await supabaseAdmin.storage.listBuckets();

    if (error || !data) {
      console.error('[health] storage no responde', error);
      checks.storage.status = 'error';
      overallStatus = 'degraded';
    }
  } catch (error) {
    console.error('[health] excepción en storage', error);
    checks.storage.status = 'error';
    overallStatus = 'degraded';
  }

  return res.status(overallStatus === 'ok' ? 200 : 503).json({
    status: overallStatus,
    service: 'patitas-api',
    timestamp: new Date().toISOString(),
    checks,
    ...(IS_PRODUCTION ? {} : { environment: 'non-production' }),
  });
}
