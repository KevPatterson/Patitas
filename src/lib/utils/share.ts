type ShareData = {
  title: string;
  text: string;
  url: string;
};

export function canUseWebShare(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

export type WebShareResult = 'shared' | 'cancelled' | 'unsupported' | 'failed';

/**
 * Abre el diálogo nativo de compartir.
 *
 * Se distingue entre cancelar (no es un error), no soportado y fallo real: en
 * escritorio hay navegadores que exponen `navigator.share` pero no abren nada,
 * y la UI necesita saber cuándo ofrecer una alternativa.
 */
export async function shareViaWebAPI(data: ShareData): Promise<WebShareResult> {
  if (!canUseWebShare()) {
    return 'unsupported';
  }

  try {
    await navigator.share(data);
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }

    return 'failed';
  }
}

export function shareViaWhatsApp(text: string, url: string): void {
  const message = encodeURIComponent(`${text}\n\n${url}`);
  window.open(`https://wa.me/?text=${message}`, '_blank');
}

export function shareViaFacebook(url: string): void {
  const shareUrl = encodeURIComponent(url);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank');
}

export function shareViaTelegram(text: string, url: string): void {
  const message = encodeURIComponent(text);
  const shareUrl = encodeURIComponent(url);
  window.open(`https://t.me/share/url?url=${shareUrl}&text=${message}`, '_blank');
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function buildPublicationShareData(publication: {
  title: string;
  type: string;
  location: string;
  slug: string;
}): ShareData {
  const url = `${window.location.origin}/p/${publication.slug}`;

  const typeLabel =
    (
      {
        LOST: 'está perdido',
        FOUND: 'fue encontrado',
        ABANDONED: 'fue encontrado abandonado',
        ADOPTION: 'está en adopción',
        SIGHTING: 'fue avistado',
      } as Record<string, string>
    )[publication.type] || 'necesita ayuda';

  return {
    title: publication.title,
    text: `${publication.title} ${typeLabel}\n${publication.location}\n\nAyúdanos a difundir este caso:`,
    url,
  };
}
