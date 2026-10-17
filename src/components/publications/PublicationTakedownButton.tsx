import { safeLinkUrl } from '../../lib/utils/safe-url';
import { useState } from 'react';
import { Flag, AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/button';

type TakedownReason = 'COPYRIGHT' | 'PRIVACY' | 'INACCURATE' | 'OTHER';

const REASON_LABELS: Record<TakedownReason, string> = {
  COPYRIGHT: 'Derechos de autor / Propiedad',
  PRIVACY: 'Privacidad / Datos personales',
  INACCURATE: 'Información incorrecta / Desactualizada',
  OTHER: 'Otro motivo',
};

interface PublicationTakedownButtonProps {
  publicationId: string;
  isImported?: boolean;
  sourceUrl?: string | null;
  onSuccess?: () => void;
}
export function PublicationTakedownButton({ 
  publicationId, 
  isImported = false,
  sourceUrl,
  onSuccess 
}: PublicationTakedownButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<TakedownReason>('INACCURATE');
  const [contactEmail, setContactEmail] = useState('');
  const [details, setDetails] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('sb-access-token') ?? '';
      const response = await fetch('/api/takedown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          publication_id: publicationId,
          reason: selectedReason,
          contact_email: contactEmail || undefined,
          details: details || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error enviando solicitud');
      }

      setShowModal(false);
      setSelectedReason('INACCURATE');
      setContactEmail('');
      setDetails('');
      onSuccess?.();
      
      // Mostrar mensaje de éxito
      alert('Solicitud de retirada enviada. La publicación ha sido ocultada pendiente de revisión.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowModal(true)}
        className="text-red-600 hover:bg-red-50 hover:text-red-700 gap-1"
        aria-label="Solicitar retirada de esta publicación"
      >
        <Flag className="size-3.5" />
        <span className="hidden sm:inline">Retirar</span>
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl border-2 border-navy/10 shadow-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-navy">Solicitar retirada</h3>
                <p className="text-sm text-navy/60 mt-1">
                  La publicación se ocultará inmediatamente. Un moderador revisará la solicitud.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-navy/40 hover:text-navy/70 p-1"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isImported && sourceUrl && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-blue-800 mb-1">Publicación importada</p>
                  <a href={safeLinkUrl(sourceUrl) ?? undefined} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <span>Ver fuente original →</span>
                  </a>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-navy mb-2">Motivo *</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(REASON_LABELS) as TakedownReason[]).map((reason) => (
                    <label
                      key={reason}
                      className={`relative cursor-pointer rounded-xl border-2 p-3 transition-all ${
                        selectedReason === reason
                          ? 'border-red-500 bg-red-50'
                          : 'border-navy/10 hover:border-navy/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={reason}
                        checked={selectedReason === reason}
                        onChange={() => setSelectedReason(reason)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-red-500" />
                        <span className="text-sm font-medium text-navy">{REASON_LABELS[reason]}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-sm font-semibold text-navy mb-1">
                  Email de contacto (opcional)
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full h-12 rounded-2xl border-2 border-navy/10 bg-white px-4 text-base text-navy outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
                />
                <p className="text-xs text-navy/50 mt-1">Para que podamos contactarte si necesitamos más información.</p>
              </div>

              <div>
                <label htmlFor="details" className="block text-sm font-semibold text-navy mb-1">
                  Detalles adicionales (opcional)
                </label>
                <textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Explica brevemente por qué solicitas la retirada..."
                  rows={3}
                  className="w-full rounded-2xl border-2 border-navy/10 bg-white px-4 py-3 text-base text-navy outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/20 resize-none"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle className="size-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="danger" loading={loading} className="flex-1">
                  <Flag className="size-4" />
                  Enviar solicitud
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default PublicationTakedownButton;