import type { VercelRequest, VercelResponse } from './types/vercel';
import { supabaseAdmin } from './_lib/supabase-admin';

/**
 * Health check endpoint
 * GET /api/health
 * 
 * Verifica el estado de la API y sus dependencias críticas
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const checks: Record<string, { status: string; details?: string }> = {
    api: { status: 'ok' },
    database: { status: 'unknown' },
    storage: { status: 'unknown' },
  };

  let overallStatus = 'ok';

  // Check database connection
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();

    checks.database.status = error ? 'error' : 'ok';
    if (error) {
      checks.database.details = 'Database query failed';
      overallStatus = 'degraded';
    }
  } catch (error) {
    checks.database.status = 'error';
    checks.database.details = error instanceof Error ? error.message : 'Unknown error';
    overallStatus = 'degraded';
  }

  // Check storage (basic)
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    checks.storage.status = error || !data ? 'error' : 'ok';
    if (error) {
      checks.storage.details = 'Storage unavailable';
      overallStatus = 'degraded';
    }
  } catch (error) {
    checks.storage.status = 'error';
    checks.storage.details = error instanceof Error ? error.message : 'Unknown error';
    overallStatus = 'degraded';
  }

  const statusCode = overallStatus === 'ok' ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    service: 'patitas-api',
    timestamp: new Date().toISOString(),
    checks,
  });
}
