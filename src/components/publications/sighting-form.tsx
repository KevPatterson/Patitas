import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { TextareaField } from '../ui/textarea-field';
import { TextField } from '../ui/text-field';
import { createSighting } from '../../lib/supabase/publication-actions';

type SightingFormProps = {
  publicationId: string;
  userId: string | null;
  onSuccess: () => void;
};

export function SightingForm({ publicationId, userId, onSuccess }: SightingFormProps) {
  const [note, setNote] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!note.trim()) {
      setErrorMessage('Describe dónde y cuándo viste a esta mascota.');
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      await createSighting({
        publicationId,
        reporterProfileId: userId,
        note: note.trim(),
        occurredAt: occurredAt || undefined,
      });

      setNote('');
      setOccurredAt('');
      onSuccess();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos registrar el avistamiento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="space-y-4 rounded-3xl border-2 p-5"
      style={{
        borderColor: '#CFEFE6',
        backgroundColor: 'rgba(207,239,230,0.15)',
      }}
    >
      <div>
        <p className="font-semibold" style={{ color: '#0B3B3C' }}>¿Viste a esta mascota?</p>
        <p className="mt-1 text-sm" style={{ color: 'rgba(11,59,60,0.7)' }}>Reporta un avistamiento para ayudar a ubicarla. Cada detalle cuenta.</p>
      </div>

      <TextareaField
        label="Describe el avistamiento"
        placeholder="Vi a esta mascota cerca del parque esta mañana, caminaba sola hacia el norte..."
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <TextField label="Fecha y hora (opcional)" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />

      {errorMessage ? (
        <p
          className="rounded-2xl px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: 'rgba(194,51,44,0.1)',
            color: '#C2332C',
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      <Button type="button" onClick={handleSubmit} disabled={submitting}>
        <MapPin className="size-4" aria-hidden="true" />
        {submitting ? 'Enviando...' : 'Reportar avistamiento'}
      </Button>
    </div>
  );
}
