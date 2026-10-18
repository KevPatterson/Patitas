import type { VercelRequest, VercelResponse } from './types/vercel';
import { supabaseAdmin } from './_lib/supabase-admin';

/**
 * GET /api/og?slug=<slug> — HTML con Open Graph para crawlers (tarea 6.1).
 *
 * El problema: Patitas es una SPA. Cuando pegas `https://patitass.vercel.app/p/mi-perro`
 * en WhatsApp, el crawler no ejecuta JavaScript, así que solo ve el `index.html`
 * genérico y la vista previa muestra el título del sitio y una imagen por defecto.
 * El objetivo de la fase es que la tarjeta muestre **la foto y el título de ESA
 * mascota**.
 *
 * Cómo funciona:
 *   1. `middleware.ts` detecta el user-agent del crawler en `/p/:slug` y reescribe
 *      a este endpoint. Los humanos siguen recibiendo la SPA normal.
 *   2. Aquí se lee la publicación y se devuelve HTML mínimo con las etiquetas OG.
 *
 * Privacidad: solo se usan columnas públicas (título, descripción, imagen). Nada
 * de contacto ni de coordenadas: el enlace se comparte en grupos de desconocidos.
 */

const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://patitass.vercel.app').replace(/\/$/, '');
const SITE_NAME = 'Patitas';

const TYPE_LABEL: Record<string, string> = {
  LOST: 'Mascota perdida',
  FOUND: 'Mascota encontrada',
  ABANDONED: 'Mascota abandonada',
  ADOPTION: 'En adopción',
  SIGHTING: 'Avistamiento',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Recorta la descripción sin partir palabras a la mitad. */
function summarize(text: string | null | undefined, maxLength = 180): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();

  if (clean.length <= maxLength) return clean;

  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');

  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

function renderHtml(input: {
  title: string;
  description: string;
  imageUrl: string | null;
  canonicalUrl: string;
  noindex: boolean;
}): string {
  const { title, description, imageUrl, canonicalUrl, noindex } = input;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
${noindex ? '<meta name="robots" content="noindex, nofollow" />' : ''}
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="es_CU" />
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />\n<meta property="og:image:alt" content="${escapeHtml(title)}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />` : ''}
<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : ''}
</head>
<body>
<p><a href="${escapeHtml(canonicalUrl)}">${escapeHtml(title)}</a></p>
<p>${escapeHtml(description)}</p>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const rawSlug = req.query.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const canonicalUrl = slug ? `${SITE_URL}/p/${slug}` : `${SITE_URL}/`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Los crawlers no necesitan datos en vivo, pero tampoco queremos servir una
  // tarjeta obsoleta durante días: una hora de CDN es un buen equilibrio.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');

  if (!slug) {
    return res.status(400).send(
      renderHtml({
        title: `Publicación no encontrada · ${SITE_NAME}`,
        description: 'Este enlace no corresponde a ninguna publicación de Patitas.',
        imageUrl: null,
        canonicalUrl: `${SITE_URL}/`,
        noindex: true,
      })
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('publications')
      .select(
        'slug, title, description, type, status, species, province:locations(province), publication_images(storage_path, is_cover)'
      )
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[og] error leyendo la publicación', error);
    }

    if (!data) {
      return res.status(404).send(
        renderHtml({
          title: `Publicación no encontrada · ${SITE_NAME}`,
          description: 'La publicación que buscas no existe o se ha retirado.',
          imageUrl: null,
          canonicalUrl,
          noindex: true,
        })
      );
    }

    const publication = data as unknown as {
      slug: string;
      title: string;
      description: string | null;
      type: string;
      status: string;
      species: string | null;
      province: { province: string } | Array<{ province: string }> | null;
      publication_images: Array<{ storage_path: string; is_cover: boolean }> | null;
    };

    const province = Array.isArray(publication.province)
      ? publication.province[0]?.province
      : publication.province?.province;

    const cover =
      publication.publication_images?.find((image) => image.is_cover) ??
      publication.publication_images?.[0];

    const imageUrl = cover
      ? `${process.env.SUPABASE_URL ?? ''}/storage/v1/object/public/pet-images/${cover.storage_path}`
      : null;

    const typeLabel = TYPE_LABEL[publication.type] ?? 'Publicación';
    const where = province ? ` en ${province}` : '';

    // Solo se considera indexable lo público y vigente. Lo resuelto u oculto se
    // sirve para la tarjeta (el enlace puede estar circulando) pero con noindex.
    const isPublic = publication.status === 'ACTIVE';

    return res.status(isPublic ? 200 : 200).send(
      renderHtml({
        title: `${publication.title} · ${typeLabel}${where} · ${SITE_NAME}`,
        description: summarize(publication.description) || `${typeLabel}${where} en ${SITE_NAME}.`,
        imageUrl: imageUrl || null,
        canonicalUrl,
        noindex: !isPublic,
      })
    );
  } catch (error) {
    console.error('[og] excepción', error);

    return res.status(500).send(
      renderHtml({
        title: `Patitas · Que ninguna patita se quede sin casa`,
        description:
          'Plataforma comunitaria para reencontrar mascotas perdidas, reportar encontradas y promover adopciones responsables.',
        imageUrl: null,
        canonicalUrl,
        noindex: true,
      })
    );
  }
}
