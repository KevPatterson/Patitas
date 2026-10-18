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

function removeMeta(name: string) {
  document.head.querySelector(`meta[name="${name}"]`)?.remove();
}

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
  upsertMeta('twitter:title', title);
  upsertMeta('twitter:description', description);

  if (image) {
    const absolute = absoluteUrl(image);
    upsertMeta('og:image', absolute, true);
    upsertMeta('twitter:image', absolute);
  }

  // `noindex` se pone y se quita explícitamente: al navegar de una publicación
  // resuelta a una activa, la etiqueta no debe quedarse pegada.
  if (noindex) {
    upsertMeta('robots', 'noindex, nofollow');
  } else {
    removeMeta('robots');
  }

  if (canonicalPath) {
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }

    canonical.href = absoluteUrl(canonicalPath);
  }
}