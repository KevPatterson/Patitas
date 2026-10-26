import { z } from 'zod';

/**
 * Validación para importación desde enlace de Facebook
 * Protección SSRF: allowlist estricta de dominios, sin redirecciones, timeout corto
 */

const FACEBOOK_ALLOWED_HOSTS = [
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'mbasic.facebook.com',
  'fb.com',
  'fb.watch',
  'www.fb.com',
  'l.facebook.com',  // Link shim
  'lm.facebook.com',
] as const;

const FACEBOOK_ALLOWED_SCHEMES = ['https:'] as const;

export const facebookLinkImportSchema = z.object({
  url: z.string()
    .url('URL inválida')
    .refine((url) => {
      try {
        const parsed = new URL(url);
        // Solo HTTPS
        if (parsed.protocol !== 'https:') {
          return false;
        }
        // Host en allowlist
        const hostname = parsed.hostname.toLowerCase();
        return FACEBOOK_ALLOWED_HOSTS.some((allowed) =>
          hostname === allowed || hostname.endsWith('.' + allowed)
        );
      } catch {
        return false;
      }
    }, 'Solo se permiten enlaces de facebook.com, fb.com, fb.watch'),
});

export type FacebookLinkImportInput = z.infer<typeof facebookLinkImportSchema>;

export const FACEBOOK_IMPORT_CONSTANTS = {
  ALLOWED_HOSTS: FACEBOOK_ALLOWED_HOSTS,
  ALLOWED_SCHEMES: FACEBOOK_ALLOWED_SCHEMES,
  REQUEST_TIMEOUT_MS: 8000,
  MAX_RESPONSE_SIZE: 2 * 1024 * 1024, // 2MB
  USER_AGENT: 'Mozilla/5.0 (compatible; PatitasBot/1.0; +https://patitas.app/bot)',
} as const;

interface OGMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
}

/**
 * Textos genéricos que Facebook pone cuando no puede mostrar el aviso real.
 * Si se cuelan en el formulario, la descripción acaba siendo publicidad de
 * Facebook en lugar del contenido del post.
 */
const FACEBOOK_BOILERPLATE = [
  /^facebook$/i,
  /^meta$/i,
  /see posts,? photos and more on facebook\.?$/i,
  /ver (?:publicaciones|posts),? fotos y mucho m[aá]s en facebook\.?$/i,
  /^(?:inicia sesi[oó]n|log ?in|entrar) (?:en )?facebook\.?$/i,
  /facebook te ayuda a comunicarte/i,
];

export function isFacebookBoilerplate(value?: string | null): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return true;

  return FACEBOOK_BOILERPLATE.some((pattern) => pattern.test(trimmed));
}

/**
 * Busca el contenido de una etiqueta `<meta>` sin depender del orden de los
 * atributos ni de si usa `property` o `name`.
 */
function findMetaContent(html: string, keys: string[]): string | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const key of keys) {
    for (const tag of metaTags) {
      const name = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!name || name.toLowerCase() !== key) continue;

      const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
      if (content && content.trim()) return decodeHtmlEntities(content).trim();
    }
  }

  return null;
}

/**
 * Extraer metadatos Open Graph de HTML.
 *
 * El orden de los atributos varía entre páginas (`content` puede ir antes de
 * `property`), así que se inspeccionan las etiquetas una a una.
 */
export function extractOpenGraphMetadata(html: string): OGMetadata {
  const result: OGMetadata = {
    title: null,
    description: null,
    image: null,
    url: null,
  };

  result.title =
    findMetaContent(html, ['og:title']) ?? findMetaContent(html, ['twitter:title']);

  result.description =
    findMetaContent(html, ['og:description']) ??
    findMetaContent(html, ['twitter:description']) ??
    findMetaContent(html, ['description']);

  // `og:image` admite variantes; algunas páginas solo publican la segura.
  result.image =
    findMetaContent(html, ['og:image', 'og:image:url', 'og:image:secure_url']) ??
    findMetaContent(html, ['twitter:image', 'twitter:image:src']);

  result.url = findMetaContent(html, ['og:url']);

  // Fallback al <title> del documento.
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) result.title = decodeHtmlEntities(titleMatch[1]).trim();
  }

  return result;
}

/** Convierte HTML en texto plano conservando los saltos de línea. */
function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/\s*<br\s*\/?>\s*/gi, '\n')
      .replace(/<\/(?:p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extrae el texto del post del HTML público.
 *
 * Los metadatos Open Graph de una foto suelen ser genéricos ("Facebook"), pero
 * el HTML sí incluye el mensaje en `data-ad-preview="message"` o en el JSON
 * embebido. Sin esto, importar un enlace no rellenaba ningún campo.
 */
export function extractPostText(html: string): string | null {
  const messageDiv = html.match(
    /<div[^>]*(?:data-ad-preview|data-ad-comet-preview)\s*=\s*["']message["'][^>]*>([\s\S]*?)<\/div>/i
  );

  if (messageDiv?.[1]) {
    const text = stripHtml(messageDiv[1]);
    if (text) return text;
  }

  const jsonText = html.match(/"message"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  if (jsonText?.[1]) {
    try {
      // El texto viene escapado como una cadena JSON.
      const parsed: unknown = JSON.parse(`"${jsonText[1]}"`);
      if (typeof parsed === 'string') {
        const text = parsed.replace(/\s+/g, ' ').trim();
        if (text) return text;
      }
    } catch {
      // Cadena mal escapada: se ignora y se usa lo que haya de Open Graph.
    }
  }

  return null;
}

/**
 * Extrae URLs de imágenes del post de Facebook.
 *
 * Busca en el HTML del post (no en Open Graph) para encontrar las imágenes
 * reales adjuntas al post, evitando la imagen genérica del grupo/página.
 */
export function extractPostImages(html: string): string[] {
  const images: string[] = [];

  // 1. Buscar en el div del mensaje (data-ad-preview="message")
  const messageDivMatch = html.match(
    /<div[^>]*(?:data-ad-preview|data-ad-comet-preview)\s*=\s*["']message["'][^>]*>([\s\S]*?)<\/div>/i
  );

  if (messageDivMatch?.[1]) {
    const messageHtml = messageDivMatch[1];

    // Buscar tags <img> con src
    const imgMatches = messageHtml.matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
      const url = decodeHtmlEntities(match[1]);
      if (url && isLikelyPostImage(url)) {
        images.push(url);
      }
    }

    // Buscar background-image en style
    const bgMatches = messageHtml.matchAll(/background-image\s*:\s*url\(["']?([^"')]+)["']?\)/gi);
    for (const match of bgMatches) {
      const url = decodeHtmlEntities(match[1]);
      if (url && isLikelyPostImage(url)) {
        images.push(url);
      }
    }
  }

  // 2. Buscar en JSON embebido (attachments/media)
  const jsonImageMatches = html.matchAll(/"(?:image|photo|media)"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"/gi);
  for (const match of jsonImageMatches) {
    const url = decodeHtmlEntities(match[1]);
    if (url && isLikelyPostImage(url)) {
      images.push(url);
    }
  }

  // 3. Buscar en data-ft o data-store JSON
  const dataFtMatches = html.matchAll(/data-ft\s*=\s*["']([^"']+)["']/gi);
  for (const match of dataFtMatches) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1]));
      const attachedImages = findImagesInObject(parsed);
      for (const url of attachedImages) {
        if (isLikelyPostImage(url)) {
          images.push(url);
        }
      }
    } catch {
      // Ignorar JSON inválido
    }
  }

  // Deduplicar manteniendo orden
  return [...new Set(images)];
}

/**
 * Verifica si una URL parece ser una imagen del post (no avatar, no icono, no genérica).
 */
function isLikelyPostImage(url: string): boolean {
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    const pathname = u.pathname.toLowerCase();

    // Debe ser de CDN de Facebook
    if (!hostname.includes('fbcdn.net') && !hostname.includes('scontent')) {
      return false;
    }

    // Excluir avatares, iconos, sprites, imágenes genéricas de grupo
    const excludePatterns = [
      '/s160x160/', // avatares pequeños
      '/s320x320/', // avatares medianos
      '/s40x40/',
      '/s48x48/',
      '/s64x64/',
      '/s72x72/',
      '/s96x96/',
      '/s100x100/',
      '/s128x128/',
      '/s144x144/',
      '/s180x180/',
      '/s200x200/',
      'profile_pic',
      'cover_photo',
      'group_cover',
      'page_cover',
      'avatar',
      'icon',
      'sprite',
      'emoji',
      'sticker',
      '/safe_image.php', // enlaces externos
      'static.xx.fbcdn.net', // assets estáticos
    ];

    for (const pattern of excludePatterns) {
      if (pathname.includes(pattern) || hostname.includes(pattern)) {
        return false;
      }
    }

    // Debe tener extensión de imagen o parámetros de imagen de Facebook
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
    const hasImageExt = imageExtensions.some((ext) => pathname.includes(ext));
    const hasFbImageParams = u.searchParams.has('stp') || u.searchParams.has('oe') || u.searchParams.has('_nc_');

    return hasImageExt || hasFbImageParams;
  } catch {
    return false;
  }
}

/**
 * Busca recursivamente URLs de imágenes en un objeto JSON.
 */
function findImagesInObject(obj: unknown, found: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') return found;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      findImagesInObject(item, found);
    }
  } else {
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        typeof value === 'string' &&
        (lowerKey.includes('image') ||
          lowerKey.includes('photo') ||
          lowerKey.includes('media') ||
          lowerKey.includes('src') ||
          lowerKey.includes('uri') ||
          lowerKey.includes('url')) &&
        value.startsWith('http')
      ) {
        found.push(value);
      } else if (value && typeof value === 'object') {
        findImagesInObject(value, found);
      }
    }
  }
  return found;
}

/**
 * Decodifica entidades HTML.
 *
 * Antes las sustituciones estaban invertidas (`&` por `&`), así que `&`
 * seguía literal. Eso rompía las URL de las imágenes de Facebook (`?a=1&b=2`),
 * que después no se podían descargar ni mostrar.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // `&amp;` va al final para no decodificar dos veces (`&amp;lt;` -> `&lt;`).
    .replace(/&amp;/gi, '&');
}