import type { VercelRequest, VercelResponse } from './_types/vercel.js';
import handleModeration from './_lib/admin/moderation.js';
import handleVerifications from './_lib/admin/verifications.js';

/**
 * /api/admin?resource=<moderation|verifications> — router de administración.
 *
 * Antes eran dos funciones (`api/admin/moderation.ts` y
 * `api/admin/verifications.ts`). Se consolidan para mantenerse dentro del
 * límite de doce funciones del plan Hobby de Vercel.
 *
 * El despacho es por `resource` y no por `action` porque cada handler conserva
 * su propio contrato: `moderation` recibe un `action` en el cuerpo (HIDE,
 * DELETE, etc.) y `verifications` usa el método (GET lista, POST revisa). El
 * router solo elige el handler; la autenticación, el rol y el rate limit
 * siguen viviendo en cada uno.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawResource = req.query.resource;
  const resource = Array.isArray(rawResource) ? rawResource[0] : rawResource;

  if (!resource) {
    return res.status(400).json({
      error: 'Falta el parámetro resource',
      code: 'INVALID_INPUT',
      allowed: ['moderation', 'verifications'],
    });
  }

  switch (resource) {
    case 'moderation':
      return handleModeration(req, res);
    case 'verifications':
      return handleVerifications(req, res);
    default:
      return res.status(400).json({
        error: 'Recurso desconocido. Usa ?resource=moderation o ?resource=verifications',
        code: 'INVALID_INPUT',
      });
  }
}
