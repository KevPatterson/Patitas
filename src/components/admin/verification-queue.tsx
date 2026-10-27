import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CheckCircle, Clock, ExternalLink, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { VerifiedBadge } from '../ui/verified-badge';
import {
  VERIFICATION_KIND_LABELS,
  type VerificationKind,
  type VerificationStatus,
} from '../../lib/supabase/trust';
import { confirmDialog, notifyError, notifySuccess, promptText } from '../../lib/ui/sweetalert';
import { safeLinkUrl } from '../../lib/utils/safe-url';

type AdminVerification = {
  id: string;
  profile_id: string;
  kind: VerificationKind;
  status: VerificationStatus;
  evidence_url: string | null;
  note: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

const FILTERS: Array<{ id: VerificationStatus; label: string }> = [
  { id: 'PENDING', label: 'Pendientes' },
  { id: 'APPROVED', label: 'Aprobadas' },
  { id: 'REJECTED', label: 'Rechazadas' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error('No hay sesión activa.');

  return { Authorization: `Bearer ${token}` };
}

/**
 * Lee el JSON de la respuesta sin romper cuando el cuerpo no es JSON (por
 * ejemplo, el HTML de Vite en desarrollo al no servir `/api`).
 */
async function readJson<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Cola de verificación de perfiles.
 *
 * Lee y escribe por la API de administración: la evidencia no tiene SELECT para
 * el cliente y cada decisión queda auditada en `audit_logs`.
 */
export function VerificationQueue() {
  const [filter, setFilter] = useState<VerificationStatus>('PENDING');
  const [items, setItems] = useState<AdminVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: VerificationStatus) => {
    setLoading(true);
    setError(null);

    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/admin?resource=verifications&status=${status}`, { headers });
      const payload = await readJson<{ items?: AdminVerification[]; error?: string }>(response);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (response.status === 404
              ? 'No se encontró la API local. Ejecuta `vercel dev` para servir /api.'
              : `No se pudo cargar la cola (${response.status}).`)
        );
      }

      setItems(payload?.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la cola.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const review = async (
    verification: AdminVerification,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string
  ) => {
    setActionId(verification.id);

    try {
      const headers = await authHeaders();
      const response = await fetch('/api/admin?resource=verifications', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: verification.id, decision, reason }),
      });

      const payload = await readJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload?.error || `No se pudo revisar la solicitud (${response.status}).`);
      }

      notifySuccess(
        decision === 'APPROVED' ? 'Verificación aprobada' : 'Verificación rechazada',
        decision === 'APPROVED'
          ? `@${verification.profile?.username ?? 'usuario'} ya tiene el badge.`
          : 'La persona recibirá el aviso en su bandeja.'
      );
      await load(filter);
    } catch (reviewError) {
      notifyError(
        'No se pudo revisar la solicitud',
        reviewError instanceof Error ? reviewError.message : 'Inténtalo de nuevo.'
      );
    } finally {
      setActionId(null);
    }
  };

  const handleApprove = async (verification: AdminVerification) => {
    const confirmed = await confirmDialog({
      title: '¿Aprobar esta verificación?',
      text: `@${verification.profile?.username ?? 'usuario'} mostrará el badge de ${
        VERIFICATION_KIND_LABELS[verification.kind]
      } en su perfil.`,
      confirmText: 'Aprobar',
    });

    if (!confirmed) return;

    await review(verification, 'APPROVED');
  };

  const handleReject = async (verification: AdminVerification) => {
    const reason = await promptText({
      title: 'Motivo del rechazo',
      text: 'Se guardará en la auditoría y la persona podrá volver a intentarlo.',
      placeholder: 'Por ejemplo: el enlace no demuestra la actividad indicada.',
      confirmText: 'Rechazar',
      minLength: 3,
      maxLength: 500,
      tone: 'danger',
    });

    if (reason === null) return;

    await review(verification, 'REJECTED', reason);
  };

  return (
    <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold text-foreground">
          <ShieldCheck className="size-6 text-turquoise" />
          Verificación de perfiles
        </h2>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-bold transition',
                filter === item.id
                  ? 'bg-ink text-white shadow-md'
                  : 'bg-foreground/5 text-foreground/70 hover:bg-foreground/10',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl bg-lost/10 px-4 py-3 text-sm font-semibold text-lost">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm font-semibold text-foreground/60">
          Cargando solicitudes...
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No hay solicitudes en esta bandeja"
          description="Cuando alguien pida la verificación de su perfil, aparecerá aquí."
          illustration="cat"
        />
      ) : (
        <div className="space-y-4">
          {items.map((verification) => {
            const evidenceUrl = safeLinkUrl(verification.evidence_url);
            const isPending = verification.status === 'PENDING';
            const isBusy = actionId === verification.id;

            return (
              <article
                key={verification.id}
                className="rounded-2xl border-2 border-foreground/10 bg-surface p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-turquoise/10 text-sm font-extrabold text-turquoise">
                      {verification.profile?.avatar_url ? (
                        <img
                          src={verification.profile.avatar_url}
                          alt={`Avatar de ${verification.profile.username}`}
                          className="size-full object-cover"
                        />
                      ) : (
                        (verification.profile?.username?.[0] ?? 'U').toUpperCase()
                      )}
                    </div>
                    <div>
                      <Link
                        to={`/perfil/${verification.profile?.username ?? ''}`}
                        className="font-display font-bold text-foreground hover:text-orange"
                      >
                        @{verification.profile?.username ?? 'usuario'}
                      </Link>
                      {verification.profile?.full_name ? (
                        <p className="text-sm text-foreground/60">{verification.profile.full_name}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <VerifiedBadge kind={verification.kind} />
                    <span className="inline-flex items-center gap-1 rounded-pill bg-foreground/5 px-3 py-1 text-xs font-bold text-foreground/60">
                      {verification.status === 'PENDING' ? (
                        <Clock className="size-3.5" />
                      ) : verification.status === 'APPROVED' ? (
                        <CheckCircle className="size-3.5 text-found" />
                      ) : (
                        <XCircle className="size-3.5 text-lost" />
                      )}
                      {verification.status}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-foreground/70">
                  <p>
                    <span className="font-semibold text-foreground">Solicitud:</span>{' '}
                    {formatDate(verification.created_at)}
                  </p>
                  {verification.note ? (
                    <p>
                      <span className="font-semibold text-foreground">Qué hace:</span>{' '}
                      {verification.note}
                    </p>
                  ) : null}
                  {evidenceUrl ? (
                    <a
                      href={evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex w-fit items-center gap-1 font-semibold text-orange hover:underline"
                    >
                      Ver evidencia
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : (
                    <p className="text-foreground/50">Sin enlace de evidencia.</p>
                  )}
                  {verification.review_notes ? (
                    <p>
                      <span className="font-semibold text-foreground">Nota de revisión:</span>{' '}
                      {verification.review_notes}
                    </p>
                  ) : null}
                  {verification.reviewed_at ? (
                    <p className="text-xs text-foreground/50">
                      Revisada: {formatDate(verification.reviewed_at)}
                    </p>
                  ) : null}
                </div>

                {isPending ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={isBusy}
                      onClick={() => handleApprove(verification)}
                      className="gap-1.5"
                    >
                      <BadgeCheck className="size-4" aria-hidden="true" />
                      Aprobar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleReject(verification)}
                      className="gap-1.5"
                    >
                      <XCircle className="size-4 text-lost" aria-hidden="true" />
                      Rechazar
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
