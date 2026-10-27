import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { startProcessing } from '../../lib/ai/processing';

type ProcessButtonProps = {
  publicationId: string;
  onProcessingStarted?: () => void;
};

type ProcessResult = {
  completed: number;
  failed: number;
};

export function ProcessButton({ publicationId, onProcessingStarted }: ProcessButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleProcess() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const outcome = await startProcessing(publicationId, ['embedding_text', 'moderation']);

      const jobs = outcome.jobs ?? [];
      const completed =
        outcome.completed ?? jobs.filter((job) => job.status === 'COMPLETED').length;
      const failed = outcome.failed ?? jobs.filter((job) => job.status !== 'COMPLETED').length;

      setResult({ completed, failed });
      onProcessingStarted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  if (result) {
    const allGood = result.failed === 0 && result.completed > 0;

    return (
      <div
        className={`space-y-3 rounded-xl border-2 p-4 text-center ${
          allGood ? 'border-found/20 bg-found/5' : 'border-orange/30 bg-orange/5'
        }`}
      >
        <p
          className={`flex items-center justify-center gap-2 text-sm font-medium ${
            allGood ? 'text-found' : 'text-orange-dark'
          }`}
        >
          {allGood ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          {allGood
            ? `Análisis completado (${result.completed} ${
                result.completed === 1 ? 'tarea' : 'tareas'
              }). Los resultados ya están disponibles.`
            : `El análisis terminó con ${result.failed} ${
                result.failed === 1 ? 'error' : 'errores'
              }. Revisa el estado de abajo.`}
        </p>

        <Button variant="secondary" onClick={reset} className="w-full">
          Analizar de nuevo
        </Button>
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
        La IA analizará esta publicación para detectar duplicados, extraer información y buscar
        coincidencias. El análisis se ejecuta al momento.
      </p>
    </div>
  );
}
