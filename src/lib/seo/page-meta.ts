type PageMeta = {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  /**
   * Marca la página como no indexable (tarea 6.2).
   *
   * Las publicaciones resueltas, ocultas o eliminadas no deben aparecer en
   * buscadores: el enlace puede seguir circulando, pero no queremos posicionar
   * contenido que ya no está disponible.
   */
  noindex?: boolean;
};

function upsertMeta(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    if (property) {
      element.setAttribute('property', name);
    } else {
      element.setAttribute('name', name);
    }
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function removeMeta(name: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  document.head.querySelector(selector)?.remove();
}

const SITE_NAME = 'Patitas';
const OG_LOCALE = 'es_ES';
const DEFAULT_OG_IMAGE = '/og-image.png';

/** Convierte una ruta relativa en URL absoluta: los crawlers no aceptan relativas. */
function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;

  return `${window.location.origin}${value.startsWith('/') ? '' : '/'}${value}`;
}

export function setPageMeta({ title, description, canonicalPath, image, noindex }: PageMeta) {
  document.title = title;
  upsertMeta('description', description);
  upsertMeta('og:title', title, true);
  upsertMeta('og:description', description, true);
  upsertMeta('og:site_name', SITE_NAME, true);
  upsertMeta('og:locale', OG_LOCALE, true);
  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:title', title);
  upsertMeta('twitter:description', description);

  // Siempre hay imagen: si la página no aporta una, se vuelve a la genérica.
  // Así no se queda pegada la foto de la publicación anterior al navegar.
  const imageAbsolute = absoluteUrl(image ?? DEFAULT_OG_IMAGE);
  upsertMeta('og:image', imageAbsolute, true);
  upsertMeta('og:image:alt', title, true);
  upsertMeta('twitter:image', imageAbsolute);
  upsertMeta('twitter:image:alt', title);

  if (image) {
    // Las fotos de publicaciones no son 1200x630: declarar esas medidas sería
    // mentir al crawler.
    removeMeta('og:image:secure_url', true);
    removeMeta('og:image:type', true);
    removeMeta('og:image:width', true);
    removeMeta('og:image:height', true);
  } else {
    upsertMeta('og:image:secure_url', imageAbsolute, true);
    upsertMeta('og:image:type', 'image/png', true);
    upsertMeta('og:image:width', '1200', true);
    upsertMeta('og:image:height', '630', true);
  }

  // `noindex` se pone y se quita explícitamente: al navegar de una publicación
  // resuelta a una activa, la etiqueta no debe quedarse pegada.
  if (noindex) {
    upsertMeta('robots', 'noindex, nofollow');
  } else {
    removeMeta('robots');
  }

  if (canonicalPath) {
    const canonicalUrl = absoluteUrl(canonicalPath);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }

    canonical.href = canonicalUrl;
    // `og:url` debe coincidir con el canonical; si no, algunos crawlers
    // agrupan la tarjeta bajo la URL equivocada.
    upsertMeta('og:url', canonicalUrl, true);
  }
}