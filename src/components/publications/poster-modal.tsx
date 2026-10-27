import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, Printer, Share2, X, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import {
  buildPosterFilename,
  renderPublicationPoster,
  type PosterPublication,
} from '../../lib/poster/publication-poster';

type PosterModalProps = {
  publication: PosterPublication;
  open: boolean;
  onClose: () => void;
};

type PosterState =
  | { status: 'loading' }
  | { status: 'ready'; blob: Blob; url: string; fileName: string }
  | { status: 'error'; message: string };

/**
 * Vista previa del cartel descargable.
 *
 * El cartel se genera una sola vez al abrir el modal: así la descarga y la
 * impresión reutilizan el mismo blob y no se repite el trabajo de Canvas ni la
 * descarga de la foto.
 */
function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;

  try {
    return navigator.canShare({
      files: [new File([new Blob()], 'patitas.png', { type: 'image/png' })],
    });
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Se libera en el siguiente ciclo para no cortar la descarga en Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printBlob(blob: Blob, title: string): boolean {
  // La ventana debe abrirse dentro del gesto del usuario; el blob ya está
  // generado, así que basta con escribir la imagen y lanzar la impresión.
  const printWindow = window.open('', '_blank');

  if (!printWindow) return false;

  const url = URL.createObjectURL(blob);
  printWindow.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>${title}</title>` +
      '<style>@page{margin:12mm}body{margin:0;display:flex;align-items:center;justify-content:center}' +
      'img{max-width:100%;max-height:100vh;object-fit:contain}</style></head>' +
      `<body><img src="${url}" alt="${title}" onload="window.print()" /></body></html>`
  );
  printWindow.document.close();
  printWindow.addEventListener('afterprint', () => {
    URL.revokeObjectURL(url);
    printWindow.close();
  });

  return true;
}

export function PosterModal({ publication, open, onClose }: PosterModalProps) {
  const [state, setState] = useState<PosterState>({ status: 'loading' });
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    let active = true;
    let objectUrl: string | null = null;

    setState({ status: 'loading' });
    setMessage(null);

    const generate = async () => {
      try {
        const blob = await renderPublicationPoster(publication);

        if (!active) return;

        objectUrl = URL.createObjectURL(blob);
        setState({
          status: 'ready',
          blob,
          url: objectUrl,
          fileName: buildPosterFilename(publication.slug),
        });
      } catch (error) {
        if (!active) return;

        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo generar el cartel. Inténtalo de nuevo.',
        });
      }
    };

    void generate();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, publication]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const handleDownload = useCallback(() => {
    if (state.status !== 'ready') return;
    downloadBlob(state.blob, state.fileName);
  }, [state]);

  const handleShare = useCallback(async () => {
    if (state.status !== 'ready') return;

    setMessage(null);

    try {
      const file = new File([state.blob], state.fileName, { type: 'image/png' });

      if (!navigator.canShare?.({ files: [file] })) {
        setMessage('Tu navegador no permite compartir imágenes. Descárgala y envíala desde tu galería.');
        return;
      }

      await navigator.share({
        files: [file],
        title: publication.title,
        text: 'Ayúdanos a difundir este caso.',
      });
    } catch (error) {
      // El usuario canceló el diálogo nativo: no es un error que deba mostrarse.
      if (error instanceof DOMException && error.name === 'AbortError') return;

      setMessage('No se pudo abrir el menú de compartir. Descarga el cartel e inténtalo de nuevo.');
    }
  }, [state, publication.title]);

  const handlePrint = useCallback(() => {
    if (state.status !== 'ready') return;

    if (!printBlob(state.blob, publication.title)) {
      setMessage('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo otra vez.');
    }
  }, [state, publication.title]);

  if (!open) return null;

  const shareSupported = typeof navigator !== 'undefined' && canShareFiles();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="poster-modal-title"
        tabIndex={-1}
        className="my-auto w-full max-w-4xl rounded-3xl border-2 border-orange/20 bg-surface p-5 shadow-2xl focus:outline-none md:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="poster-modal-title" className="font-display text-2xl font-extrabold text-foreground">
              Cartel para compartir
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/60">
              Descárgalo, compártelo o imprímelo. Incluye un QR que lleva directo al caso.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-foreground/10 text-foreground/60 transition-colors hover:border-foreground/20 hover:bg-foreground/5 hover:text-foreground"
            aria-label="Cerrar la vista previa del cartel"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
          <div className="order-2 space-y-3 md:order-1">
            <div className="flex items-center justify-center rounded-2xl border-2 border-foreground/10 bg-linear-to-br from-orange/10 to-found/10 p-3">
              {state.status === 'ready' ? (
                <img
                  src={state.url}
                  alt={`Cartel de ${publication.title}`}
                  className="max-h-[52vh] w-auto rounded-xl shadow-lg"
                />
              ) : state.status === 'loading' ? (
                <div className="flex aspect-3/4 w-full max-w-xs flex-col items-center justify-center gap-3 rounded-xl bg-surface/80 text-foreground/60">
                  <Loader2 className="size-8 animate-spin text-orange" aria-hidden="true" />
                  <p className="text-sm font-semibold">Generando el cartel…</p>
                  <p className="px-6 text-center text-xs text-foreground/50">
                    Estamos preparando la foto y el código QR.
                  </p>
                </div>
              ) : (
                <div className="flex aspect-3/4 w-full max-w-xs flex-col items-center justify-center gap-3 rounded-xl bg-lost/5 px-6 text-center">
                  <AlertTriangle className="size-8 text-lost" aria-hidden="true" />
                  <p className="text-sm font-bold text-foreground">No se pudo generar el cartel</p>
                  <p className="text-xs text-foreground/60">{state.message}</p>
                </div>
              )}
            </div>

            {state.status === 'ready' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={handleDownload}
                  className={shareSupported ? 'w-full' : 'w-full sm:col-span-2'}
                >
                  <Download className="size-4" aria-hidden="true" />
                  Descargar PNG
                </Button>
                {shareSupported ? (
                  <Button type="button" variant="secondary" onClick={handleShare} className="w-full">
                    <Share2 className="size-4" aria-hidden="true" />
                    Compartir imagen
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePrint}
                  className="w-full sm:col-span-2"
                >
                  <Printer className="size-4" aria-hidden="true" />
                  Imprimir
                </Button>
              </div>
            ) : null}
          </div>

          <div className="order-1 space-y-4 md:order-2">
            <div className="rounded-2xl border-2 border-foreground/10 bg-app/60 p-4">
              <h3 className="font-display text-lg font-extrabold text-foreground">Para qué sirve</h3>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/70">
                <li>Imprímelo y pégalo en la zona donde se perdió o fue encontrado.</li>
                <li>Compártelo en grupos de WhatsApp del barrio o del trabajo.</li>
                <li>Quien lo vea podrá escanear el QR y abrir el caso completo.</li>
              </ul>
            </div>

            <div className="rounded-2xl border-2 border-found/20 bg-found/5 p-4">
              <h3 className="font-display text-lg font-extrabold text-foreground">Consejos</h3>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/70">
                <li>Si la foto no aparece, se usa un diseño alternativo con la huella de Patitas.</li>
                <li>El QR lleva al sitio público: no incluye tus datos de contacto privados.</li>
                <li>Comparte también el enlace normal si la persona no puede escanear el QR.</li>
              </ul>
            </div>

            {message ? (
              <p
                role="status"
                className="rounded-2xl border-2 border-orange/20 bg-orange/10 px-4 py-3 text-sm font-semibold text-foreground"
              >
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
