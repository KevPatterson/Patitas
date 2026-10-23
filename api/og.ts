import type { VercelRequest, VercelResponse } from './types/vercel.js';
import { getSupabasePublic } from './_lib/supabase-public.js';

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
const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(
  /\/$/,
  ''
);
const SITE_NAME = 'Patitas';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

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
  imageUrl: string;
  imageIsDefault: boolean;
  canonicalUrl: string;
  noindex: boolean;
  ogType?: 'website' | 'article';
  publishedTime?: string | null;
  modifiedTime?: string | null;
  article?: Record<string, unknown>;
}): string {
  const {
    title,
    description,
    imageUrl,
    imageIsDefault,
    canonicalUrl,
    noindex,
    ogType = 'website',
    publishedTime,
    modifiedTime,
    article,
  } = input;
  // Solo la imagen genérica mide exactamente 1200x630. Las fotos subidas por
  // los usuarios tienen otras proporciones y declarar medidas falsas descuadra
  // la tarjeta en algunas redes.
  const dimensionTags = imageIsDefault
    ? `
<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />`
    : '';
  const robotsTag = noindex
    ? '<meta name="robots" content="noindex, nofollow" />'
    : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />';
  const articleTags = [
    publishedTime ? `<meta property="article:published_time" content="${escapeHtml(publishedTime)}" />` : '',
    modifiedTime ? `<meta property="article:modified_time" content="${escapeHtml(modifiedTime)}" />` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Los asistentes de IA leen el JSON-LD aunque no ejecuten JavaScript. El grafo
  // repite las entidades base del sitio para que cada publicación sea citable
  // por sí sola.
  const graph: Array<Record<string, unknown>> = [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icon-512.png`,
        width: 512,
        height: 512,
      },
      description:
        'Plataforma comunitaria gratuita para reencontrar mascotas perdidas, reportar encontradas y promover adopciones responsables en Cuba.',
      areaServed: { '@type': 'Country', name: 'Cuba' },
      knowsLanguage: 'es-CU',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      inLanguage: 'es-CU',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      inLanguage: 'es-CU',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      primaryImageOfPage: imageUrl,
    },
  ];

  if (article) graph.push(article);

  const structuredData = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<link rel="alternate" type="text/markdown" href="${SITE_URL}/llms.txt" title="Resumen de Patitas para asistentes de IA" />
${robotsTag}
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:locale" content="es_ES" />
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:image" content="${escapeHtml(imageUrl)}" />
<meta property="og:image:alt" content="${escapeHtml(title)}" />${dimensionTags}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
<meta name="twitter:image:alt" content="${escapeHtml(title)}" />
${articleTags}
<script type="application/ld+json">${structuredData}</script>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(canonicalUrl)}">Ver la publicación completa en Patitas</a></p>
</main>
<nav aria-label="Enlaces de Patitas">
<ul>
<li><a href="${SITE_URL}/">Inicio</a></li>
<li><a href="${SITE_URL}/buscar">Buscar mascotas</a></li>
<li><a href="${SITE_URL}/adopciones">Adopciones</a></li>
<li><a href="${SITE_URL}/como-funciona">Cómo funciona</a></li>
<li><a href="${SITE_URL}/preguntas-frecuentes">Preguntas frecuentes</a></li>
<li><a href="${SITE_URL}/contacto">Contacto</a></li>
</ul>
</nav>
<p>Resumen del sitio para asistentes de IA: <a href="${SITE_URL}/llms.txt">llms.txt</a>.</p>
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
  // La reescritura depende del User-Agent: sin `Vary`, una respuesta cacheada
  // para un bot podría servirse a una persona (o al revés).
  res.setHeader('Vary', 'User-Agent');
  // Los crawlers no necesitan datos en vivo, pero tampoco queremos servir una
  // tarjeta obsoleta durante días: una hora de CDN es un buen equilibrio.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');

  if (!slug) {
    return res.status(400).send(
      renderHtml({
        title: `Publicación no encontrada · ${SITE_NAME}`,
        description: 'Este enlace no corresponde a ninguna publicación de Patitas.',
        imageUrl: DEFAULT_OG_IMAGE,
        imageIsDefault: true,
        canonicalUrl: `${SITE_URL}/`,
        noindex: true,
      })
    );
  }

  try {
    const supabase = getSupabasePublic();

    if (!supabase) {
      throw new Error(
        'Falta VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
    }

    const { data, error } = await supabase
      .from('publications')
      .select(
        'slug, title, description, type, status, species, published_at, updated_at, province:locations(province), publication_images(storage_path, is_cover)'
      )
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[og] error leyendo la publicación', error);
    }

    if (!data) {
      return res.status(200).send(
        renderHtml({
          title: `Publicación no encontrada · ${SITE_NAME}`,
          description: 'La publicación que buscas no existe o se ha retirado.',
          imageUrl: DEFAULT_OG_IMAGE,
          imageIsDefault: true,
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
      published_at: string | null;
      updated_at: string | null;
      province: { province: string } | Array<{ province: string }> | null;
      publication_images: Array<{ storage_path: string; is_cover: boolean }> | null;
    };

    const province = Array.isArray(publication.province)
      ? publication.province[0]?.province
      : publication.province?.province;

    const cover =
      publication.publication_images?.find((image) => image.is_cover) ??
      publication.publication_images?.[0];

    const coverUrl =
      cover && SUPABASE_URL
        ? `${SUPABASE_URL}/storage/v1/object/public/pet-images/${cover.storage_path}`
        : null;

    if (cover && !SUPABASE_URL) {
      console.warn('[og] falta SUPABASE_URL/VITE_SUPABASE_URL: se usa la imagen genérica.');
    }

    const imageUrl = coverUrl ?? DEFAULT_OG_IMAGE;

    const typeLabel = TYPE_LABEL[publication.type] ?? 'Publicación';
    const where = province ? ` en ${province}` : '';

    // Solo se considera indexable lo público y vigente. Lo resuelto u oculto se
    // sirve para la tarjeta (el enlace puede estar circulando) pero con noindex.
    const isPublic = publication.status === 'ACTIVE';
    const description =
      summarize(publication.description) || `${typeLabel}${where} en ${SITE_NAME}.`;
    const title = `${publication.title} · ${typeLabel}${where} · ${SITE_NAME}`;

    // `Article` describe el caso completo; `about` indica que se trata de una
    // mascota sin inventar un tipo de schema.org que no existe para "mascota
    // perdida".
    const article = {
      '@type': 'Article',
      '@id': `${canonicalUrl}#article`,
      headline: publication.title,
      description,
      image: imageUrl,
      datePublished: publication.published_at ?? undefined,
      dateModified: publication.updated_at ?? publication.published_at ?? undefined,
      inLanguage: 'es-CU',
      mainEntityOfPage: canonicalUrl,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': `${SITE_URL}/#organization` },
      about: {
        '@type': 'Thing',
        additionalType: 'https://schema.org/Pet',
        name: publication.species ?? 'Mascota',
      },
      ...(province
        ? {
            contentLocation: {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                addressRegion: province,
                addressCountry: 'CU',
              },
            },
          }
        : {}),
    };

    return res.status(200).send(
      renderHtml({
        title,
        description,
        imageUrl,
        imageIsDefault: !coverUrl,
        canonicalUrl,
        noindex: !isPublic,
        ogType: 'article',
        publishedTime: publication.published_at,
        modifiedTime: publication.updated_at,
        article,
      })
    );
  } catch (error) {
    console.error('[og] excepción', error);

    // Se responde 200 incluso si falla Supabase: las redes sociales no muestran
    // la tarjeta cuando el HTML llega con un 5xx, y una imagen genérica es mejor
    // que ningún enlace preview.
    return res.status(200).send(
      renderHtml({
        title: `Patitas · Que ninguna patita se quede sin casa`,
        description:
          'Plataforma comunitaria para reencontrar mascotas perdidas, reportar encontradas y promover adopciones responsables.',
        imageUrl: DEFAULT_OG_IMAGE,
        imageIsDefault: true,
        canonicalUrl,
        noindex: true,
      })
    );
  }
}
