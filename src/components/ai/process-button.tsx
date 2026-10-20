import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { startProcessing } from '../../lib/ai/processing';

type ProcessButtonProps = {
  publicationId: string;
  onProcessingStarted?: () => void;
};

export function ProcessButton({ publicationId, onProcessingStarted }: ProcessButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleProcess() {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await startProcessing(publicationId, ['embedding_text', 'moderation']);
      setSuccess(true);
      onProcessingStarted?.();

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border-2 border-found/20 bg-found/5 p-4 text-center">
        <p className="text-sm font-medium text-found">
          ✅ Procesamiento iniciado. Los resultados aparecerán pronto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        onClick={handleProcess}
        disabled={loading}
        className="w-full gap-2 bg-purple/10 hover:bg-purple/20 text-purple-dark border-purple/20"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Analizar con IA
          </>
        )}
      </Button>

      {error && (
        <p className="text-xs text-lost bg-lost/10 border border-lost/20 rounded-lg p-2">
          {error}
        </p>
      )}

      <p className="text-xs text-foreground/60 leading-relaxed">
        💡 La IA analizará esta publicación para detectar duplicados, extraer información y buscar coincidencias.
      </p>
    </div>
  );
}
