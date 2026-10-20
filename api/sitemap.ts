import type { VercelRequest, VercelResponse } from './types/vercel';
import { supabaseAdmin } from './_lib/supabase-admin';

/**
 * GET /sitemap.xml — sitemap dinámico (tarea 6.2).
 *
 * Solo entran las publicaciones **públicas y activas**: las ocultas, resueltas,
 * eliminadas o pendientes de revisión quedan fuera, y sus páginas llevan
 * `noindex` desde el cliente (`setPageMeta` con `noindex`).
 *
 * Se capa a 5000 URLs, el máximo que admite el protocolo de sitemaps en un solo
 * archivo, y se ordena por fecha de actualización para que los buscadores vean
 * primero lo que cambió.
 */

const MAX_URLS = 5000;
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://patitass.vercel.app').replace(/\/$/, '');

type SitemapRow = {
  slug: string;
  updated_at: string | null;
  published_at: string | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  // Rutas estáticas que siempre existen.
  const staticEntries = [
    { loc: '/', priority: '1.0' },
    { loc: '/buscar', priority: '0.8' },
    { loc: '/adopciones', priority: '0.8' },
    { loc: '/mapa', priority: '0.6' },
    { loc: '/como-funciona', priority: '0.4' },
    { loc: '/preguntas-frecuentes', priority: '0.4' },
    { loc: '/seguridad', priority: '0.4' },
    { loc: '/contacto', priority: '0.4' },
    { loc: '/privacidad', priority: '0.3' },
    { loc: '/terminos', priority: '0.3' },
    { loc: '/cookies', priority: '0.3' },
    { loc: '/accesibilidad', priority: '0.3' },
  ];

  let publications: SitemapRow[] = [];

  try {
    const { data, error } = await supabaseAdmin
      .from('publications')
      .select('slug, updated_at, published_at')
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(MAX_URLS);

    if (error) {
      // Un sitemap vacío es mejor que un 500: los buscadores reintentan.
      console.error('[sitemap] no se pudieron leer las publicaciones', error);
    } else {
      publications = (data ?? []) as SitemapRow[];
    }
  } catch (error) {
    console.error('[sitemap] excepción leyendo publicaciones', error);
  }

  const urls = [
    ...staticEntries.map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(`${SITE_URL}${entry.loc}`)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`
    ),
    ...publications.map((publication) => {
      const lastmod = publication.updated_at ?? publication.published_at;

      return [
        '  <url>',
        `    <loc>${escapeXml(`${SITE_URL}/p/${publication.slug}`)}</loc>`,
        lastmod ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : '',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.7</priority>',
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    }),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Una hora de caché en el CDN: el sitemap no necesita ser instantáneo.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');

  return res.status(200).send(xml);
}
