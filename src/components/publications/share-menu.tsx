import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share2, X, Link2, MessageCircle, Send, Check, ImageDown } from 'lucide-react';
import { Button } from '../ui/button';
import { PosterModal } from './poster-modal';
import type { PosterPublication } from '../../lib/poster/publication-poster';
import {
  buildPublicationShareData,
  canUseWebShare,
  copyToClipboard,
  shareViaFacebook,
  shareViaTelegram,
  shareViaWebAPI,
  shareViaWhatsApp,
} from '../../lib/utils/share';

type ShareMenuProps = {
  /** Datos completos del caso: se usan para el texto y para el cartel. */
  publication: PosterPublication & {
    /** Ubicación ya formateada para el texto de compartir. */
    location: string;
  };
  className?: string;
};

const itemClasses =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-found/10';

export function ShareMenu({ publication, className }: ShareMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [panelLeft, setPanelLeft] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // El panel se alinea al borde derecho del botón, pero sin salirse del
  // viewport: en móvil el contenedor es estrecho y el panel quedaría cortado.
  const positionPanel = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const margin = 8;
    // `clientWidth` descuenta la barra de desplazamiento, a diferencia de `innerWidth`.
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const panelWidth = Math.min(256, viewportWidth - margin * 2);
    const viewportLeft = Math.min(
      Math.max(rect.right - panelWidth, margin),
      viewportWidth - panelWidth - margin
    );

    // `left` es relativo al contenedor, no al viewport.
    setPanelLeft(viewportLeft - rect.left);
  }, []);

  const shareData = buildPublicationShareData(publication);

  // Se memoiza por campos primitivos: el objeto que llega desde la página se
  // recrea en cada render y el cartel se regeneraría sin necesidad.
  const {
    title,
    type,
    slug,
    description,
    species,
    breed,
    sex,
    size,
    ageApprox,
    zone,
    municipality,
    province,
    coverImageUrl,
    eventDate,
    publishedAt,
  } = publication;

  const posterPublication = useMemo<PosterPublication>(
    () => ({
      title,
      type,
      slug,
      description,
      species,
      breed,
      sex,
      size,
      ageApprox,
      zone,
      municipality,
      province,
      coverImageUrl,
      eventDate,
      publishedAt,
    }),
    [
      title,
      type,
      slug,
      description,
      species,
      breed,
      sex,
      size,
      ageApprox,
      zone,
      municipality,
      province,
      coverImageUrl,
      eventDate,
      publishedAt,
    ]
  );

  const handleCopy = async () => {
    setCopyError(false);

    try {
      await copyToClipboard(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  const handleWebShare = async () => {
    const result = await shareViaWebAPI(shareData);

    if (result === 'shared' || result === 'cancelled') {
      setShowMenu(false);
      return;
    }

    // En escritorio algunos navegadores exponen `navigator.share` pero no abren
    // nada. Copiar el enlace garantiza que la opción siempre haga algo.
    await handleCopy();
  };

  const handleChannelShare = (share: () => void) => {
    share();
    setShowMenu(false);
  };

  const openPoster = () => {
    setShowMenu(false);
    setShowPoster(true);
  };

  // Cerrar al hacer clic fuera del menú, no solo con el botón «Cerrar».
  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
      }
    };

    // Al girar el móvil o cambiar el tamaño de la ventana, el panel debe
    // recalcular su posición para seguir dentro de la pantalla.
    window.addEventListener('resize', positionPanel);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', positionPanel);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu, positionPanel]);

  return (
    <div ref={containerRef} className={['relative', className].filter(Boolean).join(' ')}>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          const next = !showMenu;

          if (next) {
            positionPanel();
            setCopied(false);
            setCopyError(false);
          }

          setShowMenu(next);
        }}
        className="w-full"
        aria-expanded={showMenu}
        aria-haspopup="menu"
      >
        {showMenu ? (
          <>
            <X className="size-4" aria-hidden="true" /> Cerrar
          </>
        ) : (
          <>
            <Share2 className="size-4" aria-hidden="true" /> Compartir
          </>
        )}
      </Button>

      {showMenu ? (
        <div
          role="menu"
          style={panelLeft === null ? undefined : { left: panelLeft }}
          className="absolute top-full z-10 mt-3 max-h-[70dvh] w-64 max-w-[calc(100vw-2rem)] space-y-2 overflow-y-auto rounded-2xl border-2 border-found/30 bg-surface p-4 shadow-lg"
        >
          <button type="button" role="menuitem" onClick={openPoster} className={itemClasses}>
            <ImageDown className="size-4 text-orange" aria-hidden="true" />
            <span className="flex flex-col items-start">
              <span>Cartel para compartir</span>
              <span className="text-xs font-normal text-foreground/50">Con foto y QR descargable</span>
            </span>
          </button>

          <div className="h-px bg-foreground/10" role="separator" />

          {canUseWebShare() ? (
            <button type="button" role="menuitem" onClick={handleWebShare} className={itemClasses}>
              <Share2 className="size-4" aria-hidden="true" />
              <span>Compartir</span>
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleChannelShare(() => shareViaWhatsApp(shareData.text, shareData.url))}
            className={itemClasses}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleChannelShare(() => shareViaTelegram(shareData.text, shareData.url))}
            className={itemClasses}
          >
            <Send className="size-4" aria-hidden="true" />
            <span>Telegram</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleChannelShare(() => shareViaFacebook(shareData.url))}
            className={itemClasses}
          >
            <Share2 className="size-4" aria-hidden="true" />
            <span>Facebook</span>
          </button>
          <button type="button" role="menuitem" onClick={handleCopy} className={itemClasses}>
            {copied ? (
              <Check className="size-4 text-found" aria-hidden="true" />
            ) : (
              <Link2 className="size-4" aria-hidden="true" />
            )}
            <span>{copied ? 'Copiado' : copyError ? 'No se pudo copiar' : 'Copiar enlace'}</span>
          </button>
        </div>
      ) : null}

      <PosterModal
        publication={posterPublication}
        open={showPoster}
        onClose={() => setShowPoster(false)}
      />
    </div>
  );
}
