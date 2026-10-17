import { useEffect, useState } from 'react';
import { Copy, CheckCircle, XCircle, Eye } from 'lucide-react';
import { getPendingDuplicates, markDuplicateAsReviewed, type DuplicateDetection } from '../../lib/ai/duplicates';
import { Button } from '../ui/button';

export function DuplicateReview() {
  const [duplicates, setDuplicates] = useState<DuplicateDetection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDuplicates();
  }, []);

  async function loadDuplicates() {
    setLoading(true);
    try {
      const data = await getPendingDuplicates(20);
      setDuplicates(data);
    } catch (error) {
      console.error('Error loading duplicates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(detectionId: string, isDuplicate: boolean) {
    try {
      await markDuplicateAsReviewed(detectionId, isDuplicate);
      loadDuplicates();
    } catch (error) {
      console.error('Error reviewing duplicate:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy/20 border-t-orange" />
          <p className="text-sm font-semibold text-navy/70">Cargando duplicados...</p>
        </div>
      </div>
    );
  }

  if (duplicates.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-navy/10 bg-white p-8 text-center">
        <CheckCircle className="size-12 text-found mx-auto mb-3" />
        <h3 className="font-display text-lg font-bold text-navy mb-2">
          ¡Todo revisado!
        </h3>
        <p className="text-navy/70">
          No hay duplicados pendientes de revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-navy">
          Duplicados detectados
        </h2>
        <span className="rounded-full bg-orange/20 px-3 py-1 text-sm font-bold text-orange-dark">
          {duplicates.length} pendientes
        </span>
      </div>

      {duplicates.map((dup) => (
        <div
          key={dup.id}
          className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <Copy className="size-6 text-orange" />
            </div>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold bg-orange/20 text-orange-dark">
                    {Math.round(dup.duplicate_probability * 100)}% probabilidad
                  </span>
                  <span className="text-xs text-navy/60">
                    Score: {dup.similarity_score}
                  </span>
                </div>

                <span className="text-xs text-navy/50">
                  {new Date(dup.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>

              {/* Indicators */}
              <div className="flex flex-wrap gap-2 mb-4">
                {dup.same_text && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-lost/10 px-2 py-1 text-xs font-medium text-lost">
                    Texto idéntico
                  </span>
                )}
                {dup.similar_text && !dup.same_text && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange/10 px-2 py-1 text-xs font-medium text-orange-dark">
                    Texto similar
                  </span>
                )}
                {dup.same_location && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-lost/10 px-2 py-1 text-xs font-medium text-lost">
                    Misma ubicación
                  </span>
                )}
                {dup.same_date && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-lost/10 px-2 py-1 text-xs font-medium text-lost">
                    Misma fecha
                  </span>
                )}
                {dup.same_image_hash && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-lost/10 px-2 py-1 text-xs font-medium text-lost">
                    Misma imagen
                  </span>
                )}
                {dup.similar_image && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange/10 px-2 py-1 text-xs font-medium text-orange-dark">
                    Imagen similar
                  </span>
                )}
              </div>

              {/* Publication Links */}
              <div className="mb-4 p-3 rounded-xl bg-navy/5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-navy/60">Publicación A:</span>
                  <a
                    href={`/admin/publicaciones/${dup.publication_a_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple hover:underline inline-flex items-center gap-1"
                  >
                    Ver publicación
                    <Eye className="size-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-navy/60">Publicación B:</span>
                  <a
                    href={`/admin/publicaciones/${dup.publication_b_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple hover:underline inline-flex items-center gap-1"
                  >
                    Ver publicación
                    <Eye className="size-3" />
                  </a>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleReview(dup.id, true)}
                  className="h-9 px-4 text-sm gap-2 bg-lost/10 hover:bg-lost/20 text-lost"
                >
                  <CheckCircle className="size-4" />
                  Es duplicado
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleReview(dup.id, false)}
                  className="h-9 px-4 text-sm gap-2 bg-found hover:bg-found-dark"
                >
                  <XCircle className="size-4" />
                  No es duplicado
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
