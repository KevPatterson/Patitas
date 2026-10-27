import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../app/auth-context';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { VerifiedBadge } from '../ui/verified-badge';
import {
  VERIFICATION_KIND_LABELS,
  VERIFICATION_STATUS_LABELS,
  cancelVerification,
  getMyVerification,
  requestVerification,
  type ProfileVerification,
  type VerificationKind,
} from '../../lib/supabase/trust';
import { confirmDialog, notifyError, notifySuccess } from '../../lib/ui/sweetalert';

const KINDS: VerificationKind[] = ['RESCUER', 'SHELTER', 'VET', 'ORG'];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', { dateStyle: 'medium' });
}

/**
 * Solicitud y estado de la verificación del perfil.
 *
 * La evidencia no se vuelve a leer desde el cliente (solo la ve moderación).
 * Aquí se muestra el estado y se permite cancelar mientras está pendiente.
 */
export function VerificationCard() {
  const { user } = useAuth();
  const userId = user?.id;

  const [verification, setVerification] = useState<ProfileVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [kind, setKind] = useState<VerificationKind>('RESCUER');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const current = await getMyVerification();
      setVerification(current);
      if (current) setKind(current.kind);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar tu verificación.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await requestVerification({ kind, evidenceUrl, note });
      setEvidenceUrl('');
      setNote('');
      await load();
      notifySuccess('Solicitud enviada', 'Moderación revisará tu perfil y te avisaremos.');
    } catch (submitError) {
      notifyError(
        'No se pudo enviar la solicitud',
        submitError instanceof Error ? submitError.message : 'Inténtalo de nuevo en unos segundos.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!verification) return;

    const confirmed = await confirmDialog({
      title: '¿Cancelar la solicitud?',
      text: 'Podrás volver a enviarla cuando quieras.',
      confirmText: 'Cancelar solicitud',
      cancelText: 'Conservarla',
      tone: 'danger',
    });

    if (!confirmed) return;

    setCancelling(true);

    try {
      await cancelVerification(verification.id);
      setVerification(null);
      notifySuccess('Solicitud cancelada');
    } catch (cancelError) {
      notifyError(
        'No se pudo cancelar',
        cancelError instanceof Error ? cancelError.message : 'Inténtalo de nuevo.'
      );
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md">
        <p className="text-sm font-semibold text-foreground/60">Cargando verificación...</p>
      </div>
    );
  }

  const canRequest = !verification || verification.status === 'REJECTED';

  return (
    <div className="rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-turquoise/10">
          <ShieldCheck className="size-6 text-turquoise" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display text-xl font-extrabold text-foreground">Verificación de perfil</h3>
          <p className="mt-1 text-sm text-foreground/60">
            El badge ayuda a la comunidad a identificar rescatistas, refugios y veterinarias de confianza.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-lost/10 px-4 py-3 text-sm font-semibold text-lost">{error}</p>
      ) : null}

      {verification?.status === 'APPROVED' ? (
        <div className="rounded-2xl border-2 border-found/20 bg-found/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <VerifiedBadge kind={verification.kind} />
            <span className="text-sm font-semibold text-found">
              {VERIFICATION_STATUS_LABELS.APPROVED}
            </span>
          </div>
          <p className="text-sm text-foreground/70">
            Aprobada el {formatDate(verification.reviewed_at)}. Ya aparece en tu perfil público.
          </p>
        </div>
      ) : null}

      {verification?.status === 'PENDING' ? (
        <div className="rounded-2xl border-2 border-orange/20 bg-orange/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-orange" aria-hidden="true" />
            <span className="text-sm font-bold text-orange">
              {VERIFICATION_STATUS_LABELS.PENDING}
            </span>
          </div>
          <p className="text-sm text-foreground/70">
            Recibimos tu solicitud como {VERIFICATION_KIND_LABELS[verification.kind].toLowerCase()}.
            Te avisaremos cuando esté revisada.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelando...' : 'Cancelar solicitud'}
          </Button>
        </div>
      ) : null}

      {verification?.status === 'REJECTED' ? (
        <div className="rounded-2xl border-2 border-lost/20 bg-lost/5 p-5">
          <div className="flex items-center gap-2">
            <XCircle className="size-5 text-lost" aria-hidden="true" />
            <span className="text-sm font-bold text-lost">
              {VERIFICATION_STATUS_LABELS.REJECTED}
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground/70">
            No pudimos validar tu solicitud. Puedes volver a intentarlo con más detalles o un enlace
            que demuestre tu trabajo.
          </p>
        </div>
      ) : null}

      {canRequest ? (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-semibold text-foreground" htmlFor="verification-kind">
            <span>Tipo de verificación</span>
            <select
              id="verification-kind"
              className="h-12 w-full rounded-2xl border-2 border-foreground/10 bg-surface px-4 text-base text-foreground outline-none transition focus:border-orange"
              value={kind}
              onChange={(event) => setKind(event.target.value as VerificationKind)}
            >
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {VERIFICATION_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <TextField
            label="Enlace de evidencia"
            hint="Opcional, pero acelera la revisión"
            name="verification-evidence"
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={evidenceUrl}
            onChange={(event) => setEvidenceUrl(event.target.value)}
            maxLength={500}
          />

          <label className="block space-y-2 text-sm font-semibold text-foreground" htmlFor="verification-note">
            <span>Cuéntanos qué haces</span>
            <textarea
              id="verification-note"
              className="min-h-24 w-full rounded-2xl border-2 border-foreground/10 bg-surface px-4 py-3 text-base text-foreground outline-none transition focus:border-orange"
              placeholder="Por ejemplo: rescatista en Marianao desde 2021, con traslados y esterilizaciones."
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
            />
            <span className="block text-xs font-medium text-foreground/50">{note.length}/500</span>
          </label>

          <Button type="submit" variant="primary" loading={submitting} className="w-full gap-2">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Enviar solicitud
          </Button>
        </form>
      ) : null}
    </div>
  );
}
