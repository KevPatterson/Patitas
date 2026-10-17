import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, MessageSquare, Clock, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { Button } from '../ui/button';
import { PawLoader } from '../ui/paw-loader';
import { EmptyState } from '../ui/empty-state';
import {
  getMyAdoptionRequests,
  getReceivedAdoptionRequests,
  updateAdoptionRequestStatus,
  cancelAdoptionRequest,
  type AdoptionRequest,
  type AdoptionRequestStatus,
} from '../../lib/supabase/adoption-requests';
import { supabase } from '../../lib/supabase/client';

/**
 * Panel de adopciones (tarea 5.2).
 *
 * Dos vistas en el dashboard:
 *   - **Recibidas**: para el dueño de la publicación. Permite aceptar o rechazar
 *     dejando una nota, que se guarda en `owner_notes`.
 *   - **Enviadas**: para el solicitante, con el estado visible en todo momento.
 *
 * Los permisos NO los decide este componente: quien puede aceptar es la RLS de
 * `adoption_requests` (política de 0005), y la notificación al solicitante la
 * crea un trigger (migración 0017), no el cliente.
 */

const STATUS_LABEL: Record<AdoptionRequestStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const STATUS_STYLE: Record<AdoptionRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  ACCEPTED: 'bg-found/10 text-found border-found/30',
  REJECTED: 'bg-lost/10 text-lost border-lost/30',
  CANCELLED: 'bg-navy/5 text-navy/60 border-navy/20',
};

const STATUS_ICON: Record<AdoptionRequestStatus, typeof Clock> = {
  PENDING: Clock,
  ACCEPTED: CheckCircle2,
  REJECTED: XCircle,
  CANCELLED: Ban,
};

function StatusBadge({ status }: { status: AdoptionRequestStatus }) {
  const Icon = STATUS_ICON[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

function coverUrl(request: AdoptionRequest): string | null {
  const cover =
    request.publication.publication_images?.find((image) => image.is_cover) ??
    request.publication.publication_images?.[0];

  if (!cover) return null;

  return supabase.storage.from('pet-images').getPublicUrl(cover.storage_path).data.publicUrl;
}

export function AdoptionRequestsPanel() {
  const [received, setReceived] = useState<AdoptionRequest[]>([]);
  const [sent, setSent] = useState<AdoptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  /**
   * Evita cargas solapadas.
   *
   * Cada consulta de adopciones llama a `auth.getUser()`, que es una petición de
   * red y puede refrescar el token. Si dos cargas se solapan (por un remontaje o
   * por pulsar «Actualizar» dos veces), las respuestas pueden llegar en cualquier
   * orden y dejar la lista parpadeando. Con esta bandera, una carga en curso hace
   * que las siguientes se ignoren hasta que termine.
   */
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;

    inFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      const [receivedData, sentData] = await Promise.all([
        getReceivedAdoptionRequests(),
        getMyAdoptionRequests(),
      ]);

      setReceived(receivedData);
      setSent(sentData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No pudimos cargar tus solicitudes de adopción.'
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (requestId: string, status: 'ACCEPTED' | 'REJECTED') => {
    setBusyId(requestId);
    setError(null);

    try {
      await updateAdoptionRequestStatus(requestId, status, notesById[requestId]);
      await load();
    } catch (respondError) {
      setError(
        respondError instanceof Error ? respondError.message : 'No pudimos actualizar la solicitud.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (requestId: string) => {
    setBusyId(requestId);
    setError(null);

    try {
      await cancelAdoptionRequest(requestId);
      await load();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error ? cancelError.message : 'No pudimos cancelar la solicitud.'
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <PawLoader size="md" />
      </div>
    );
  }

  const pendingReceived = received.filter((request) => request.status === 'PENDING');
  const activeSent = sent.filter(
    (request) => request.status === 'PENDING' || request.status === 'ACCEPTED'
  );

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl border-2 border-lost/20 bg-lost/10 px-4 py-3 text-sm font-medium text-lost">
          {error}
        </div>
      )}

      {/* ── Solicitudes recibidas ─────────────────────────────────────────── */}
      <section aria-labelledby="adopciones-recibidas" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="adopciones-recibidas" className="font-display text-xl font-extrabold text-navy">
            Solicitudes recibidas
            {pendingReceived.length > 0 && (
              <span className="ml-2 rounded-full bg-orange/15 px-2 py-0.5 text-xs font-bold text-orange">
                {pendingReceived.length} pendiente{pendingReceived.length === 1 ? '' : 's'}
              </span>
            )}
          </h2>
          <Button variant="ghost" className="text-sm" onClick={() => void load()}>
            Actualizar
          </Button>
        </div>

        {received.length === 0 ? (
          <EmptyState
            title="Todavía no hay solicitudes"
            description="Cuando alguien quiera adoptar una de tus mascotas, la solicitud aparecerá aquí."
          />
        ) : (
          <ul className="space-y-3">
            {received.map((request) => {
              const image = coverUrl(request);
              const isPending = request.status === 'PENDING';
              const busy = busyId === request.id;

              return (
                <li
                  key={request.id}
                  className="rounded-2xl border-2 border-navy/10 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <Link
                      to={`/p/${request.publication.slug}`}
                      className="size-16 shrink-0 overflow-hidden rounded-xl border border-navy/10 bg-cream"
                    >
                      {image ? (
                        <img
                          src={image}
                          alt={request.publication.title}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-xs text-navy/40">
                          Sin foto
                        </span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/p/${request.publication.slug}`}
                          className="truncate font-semibold text-navy hover:text-orange"
                        >
                          {request.publication.title}
                        </Link>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="text-sm text-navy/70">
                        De{' '}
                        <Link
                          to={`/perfil/${request.requester?.username ?? ''}`}
                          className="font-semibold text-purple hover:underline"
                        >
                          @{request.requester?.username ?? 'usuario'}
                        </Link>{' '}
                        · {new Date(request.created_at).toLocaleDateString('es-CU')}
                      </p>
                      {request.message && (
                        <p className="flex items-start gap-1.5 rounded-xl bg-cream/60 px-3 py-2 text-sm text-navy/80">
                          <MessageSquare className="mt-0.5 size-4 shrink-0 text-navy/40" aria-hidden />
                          {request.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {isPending && (
                    <div className="mt-4 space-y-2 border-t border-navy/10 pt-3">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-navy/60">
                        Nota para el solicitante (opcional)
                        <textarea
                          value={notesById[request.id] ?? ''}
                          onChange={(event) =>
                            setNotesById((prev) => ({ ...prev, [request.id]: event.target.value }))
                          }
                          maxLength={1000}
                          rows={2}
                          className="mt-1 w-full rounded-xl border-2 border-navy/10 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-navy focus:border-orange focus:outline-none"
                          placeholder="Por ejemplo: ¿puedes venir a conocerla este fin de semana?"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          className="h-9 gap-1.5 px-3 text-sm"
                          disabled={busy}
                          onClick={() => void respond(request.id, 'ACCEPTED')}
                        >
                          <Check className="size-4" aria-hidden />
                          Aceptar
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-9 gap-1.5 px-3 text-sm text-lost"
                          disabled={busy}
                          onClick={() => void respond(request.id, 'REJECTED')}
                        >
                          <X className="size-4" aria-hidden />
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Solicitudes enviadas ──────────────────────────────────────────── */}
      <section aria-labelledby="adopciones-enviadas" className="space-y-3">
        <h2 id="adopciones-enviadas" className="font-display text-xl font-extrabold text-navy">
          Mis solicitudes enviadas
        </h2>

        {sent.length === 0 ? (
          <EmptyState
            title="No has solicitado ninguna adopción"
            description="Cuando pidas adoptar una mascota verás aquí el estado de tu solicitud."
          />
        ) : (
          <ul className="space-y-2">
            {sent.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-navy/10 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    to={`/p/${request.publication.slug}`}
                    className="truncate font-semibold text-navy hover:text-orange"
                  >
                    {request.publication.title}
                  </Link>
                  <p className="text-xs text-navy/60">
                    Enviada el {new Date(request.created_at).toLocaleDateString('es-CU')}
                    {request.resolved_at
                      ? ` · respondida el ${new Date(request.resolved_at).toLocaleDateString('es-CU')}`
                      : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={request.status} />
                  {request.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      disabled={busyId === request.id}
                      onClick={() => void cancel(request.id)}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {activeSent.length > 0 && (
          <p className="text-xs text-navy/50">
            Tienes {activeSent.length} solicitud{activeSent.length === 1 ? '' : 'es'} en curso.
            Recibirás una notificación cuando el dueño responda.
          </p>
        )}
      </section>
    </div>
  );
}

export default AdoptionRequestsPanel;
