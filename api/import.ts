import type { VercelRequest, VercelResponse } from './_types/vercel.js';
import handleFacebookLink from './_lib/import/facebook-link.js';
import handleFacebookScreenshot from './_lib/import/facebook-screenshot.js';

// La captura de pantalla viaja en multipart y puede acercarse a 8 MB, el mismo
// límite que aceptaba el handler suelto antes de la consolidación.
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

/**
 * POST /api/import?action=<link|screenshot> — importación desde Facebook.
 *
 * Antes eran dos funciones (`api/import/facebook-link.ts` y
 * `api/import/facebook-screenshot.ts`). Comparten JWT, rate limit por IP y por
 * usuario, proveedor de IA y `buildFormExtraction`, así que se consolidan para
 * no gastar dos funciones del plan Hobby.
 *
 * La diferencia está en el cuerpo: `link` recibe JSON con la URL y
 * `screenshot` recibe multipart con la imagen. Cada handler lo valida por su
 * cuenta; el router solo despacha.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawAction = req.query.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction;

  if (!action) {
    return res.status(400).json({
      error: 'Falta el parámetro action',
      code: 'INVALID_INPUT',
      allowed: ['link', 'screenshot'],
    });
  }

  switch (action) {
    case 'link':
      return handleFacebookLink(req, res);
    case 'screenshot':
      return handleFacebookScreenshot(req, res);
    default:
      return res.status(400).json({
        error: 'Acción desconocida. Usa ?action=link o ?action=screenshot',
        code: 'INVALID_INPUT',
      });
  }
}
