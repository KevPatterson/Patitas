import type { VercelRequest, VercelResponse } from './_types/vercel.js';
import handleOg from './_lib/seo/og.js';
import handleSitemap from './_lib/seo/sitemap.js';

/**
 * GET /api/seo?action=<og|sitemap> — router de las respuestas para buscadores.
 *
 * Se consolidaron aquí `api/og.ts` y `api/sitemap.ts` para no gastar dos de las
 * doce funciones que permite el plan Hobby de Vercel. Ambos handlers son
 * públicos, de solo lectura y comparten el cliente público de Supabase, así que
 * no mezclan modelos de autenticación.
 *
 * Los rewrites de `vercel.json` son los que exponen las rutas históricas:
 *   - `/sitemap.xml`          -> `/api/seo?action=sitemap`
 *   - `/p/:slug` (solo bots)  -> `/api/seo?action=og&slug=:slug`
 *
 * Los handlers validan el método por su cuenta (solo GET y HEAD) y fijan sus
 * propias cabeceras de caché, por eso el router no las toca.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawAction = req.query.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction;

  if (!action) {
    return res.status(400).json({
      error: 'Falta el parámetro action',
      code: 'INVALID_INPUT',
      allowed: ['og', 'sitemap'],
    });
  }

  switch (action) {
    case 'og':
      return handleOg(req, res);
    case 'sitemap':
      return handleSitemap(req, res);
    default:
      return res.status(400).json({
        error: 'Acción desconocida. Usa ?action=og o ?action=sitemap',
        code: 'INVALID_INPUT',
      });
  }
}
