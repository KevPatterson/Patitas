import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { getDuplicatesForPublication, type DuplicateDetection } from '../../lib/ai/duplicates';
import { Button } from '../ui/button';

type DuplicateWarningProps = {
  publicationId: string;
  onViewDuplicate?: (duplicateId: string) => void;
};

export function DuplicateWarning({ publicationId, onViewDuplicate }: DuplicateWarningProps) {
  const [duplicates, setDuplicates] = useState<DuplicateDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const dups = await getDuplicatesForPublication(publicationId);
        if (mounted) {
          setDuplicates(dups.filter((d) => !d.reviewed));
        }
      } catch (error) {
        console.error('Error loading duplicates:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [publicationId]);

  if (loading || duplicates.length === 0 || dismissed) {
    return null;
  }

  // Mostrar solo el duplicado con mayor probabilidad
  const topDuplicate = duplicates[0];
  const otherPublicationId =
    topDuplicate.publication_a_id === publicationId
      ? topDuplicate.publication_b_id
      : topDuplicate.publication_a_id;

  return (
    <div className="rounded-xl border-2 border-orange/30 bg-orange/5 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-orange shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm font-bold text-foreground mb-1">
            Posible publicación duplicada
          </h3>
          <p className="text-sm text-foreground/70 mb-3">
            Detectamos una publicación similar a esta (
            {Math.round(topDuplicate.duplicate_probability * 100)}% de probabilidad).
            {duplicates.length > 1 && ` Y ${duplicates.length - 1} más.`}
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            {topDuplicate.same_text && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange/20 px-2 py-1 text-xs font-medium text-orange-dark">
                Texto similar
              </span>
            )}
            {topDuplicate.same_location && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange/20 px-2 py-1 text-xs font-medium text-orange-dark">
                Misma ubicación
              </span>
            )}
            {topDuplicate.same_date && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange/20 px-2 py-1 text-xs font-medium text-orange-dark">
                Misma fecha
              </span>
            )}
            {topDuplicate.same_image_hash && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange/20 px-2 py-1 text-xs font-medium text-orange-dark">
                Misma imagen
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => onViewDuplicate?.(otherPublicationId)}
              className="h-9 px-4 text-sm gap-2 bg-orange hover:bg-orange-dark"
            >
              <ExternalLink className="size-4" />
              Ver publicación similar
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="h-9 px-4 text-sm text-foreground/60 hover:text-foreground"
            >
              Ignorar
            </Button>
          </div>

          <p className="mt-3 text-xs text-foreground/60 leading-relaxed">
            ℹ️ Si esta es una publicación diferente, puedes ignorar esta advertencia. Los
            moderadores revisarán los duplicados periódicamente.
          </p>
        </div>
      </div>
    </div>
  );
}
