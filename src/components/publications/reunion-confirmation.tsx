import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, HandHeart } from 'lucide-react';
import { useAuth } from '../../app/auth-context';
import { Button } from '../ui/button';
import {
  confirmReunion,
  getPublicationReunionStatus,
  type PublicationReunionStatus,
} from '../../lib/supabase/trust';
import { notifyError, notifySuccess } from '../../lib/ui/sweetalert';

type ReunionConfirmationProps = {
  publicationId: string;
};

function StatusPill({ label, done }: { label: string; done: boolean }) {
  const Icon = done ? CheckCircle2 : Circle;

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-bold',
        done ? 'bg-found/15 text-found' : 'bg-foreground/5 text-foreground/60',
      ].join(' ')}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Confirmación de reencuentro en casos resueltos.
 *
 * La reputación no se basa en estrellas: solo cuenta cuando el dueño y quien
 * encontró a la mascota confirman el mismo caso. El RPC valida la participación
 * real y rechaza a quien no haya intervenido.
 */
export function ReunionConfirmation({ publicationId }: ReunionConfirmationProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const [status, setStatus] = useState<PublicationReunionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const current = await getPublicationReunionStatus(publicationId);
      setStatus(current);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'No se pudo cargar el reencuentro.'
      );
    } finally {
      setLoading(false);
    }
  }, [publicationId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirm = async () => {
    setConfirming(true);

    try {
      const role = await confirmReunion(publicationId);
      await load();
      notifySuccess(
        'Reencuentro confirmado',
        role === 'OWNER'
          ? 'Gracias por cerrar el caso. Tu historial ya lo refleja.'
          : 'Gracias por ayudar. El dueño recibirá tu confirmación.'
      );
    } catch (confirmError) {
      notifyError(
        'No se pudo confirmar',
        confirmError instanceof Error ? confirmError.message : 'Inténtalo de nuevo en unos segundos.'
      );
    } finally {
      setConfirming(false);
    }
  };

  if (!userId || loading || !status) return null;

  const isOwner = status.myRole === 'OWNER';
  const isFinder = status.myRole === 'FINDER';

  return (
    <div className="rounded-3xl border-2 border-found/20 bg-found/5 p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-found/10">
          <HandHeart className="size-6 text-found" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl font-extrabold text-foreground">Confirmar reencuentro</h2>
          <p className="mt-1 text-sm text-foreground/70">
            La reputación de Patitas se basa en reencuentros confirmados por ambas partes, no en
            estrellas. Solo cuenta si participaste en este caso.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill label="Dueño confirmó" done={status.ownerConfirmed} />
        <StatusPill label="Quien lo encontró confirmó" done={status.finderConfirmed} />
      </div>

      {isOwner || isFinder ? (
        <p className="rounded-xl bg-found/10 px-4 py-3 text-sm font-semibold text-found">
          Ya confirmaste este reencuentro como {isOwner ? 'dueño del caso' : 'quien lo encontró'}.
        </p>
      ) : (
        <Button
          type="button"
          variant="primary"
          loading={confirming}
          onClick={handleConfirm}
          className="w-full gap-2"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Confirmar reencuentro
        </Button>
      )}

      {error ? <p className="text-sm font-semibold text-lost">{error}</p> : null}
    </div>
  );
}
