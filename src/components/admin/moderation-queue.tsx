import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../ui/button';
import type { ModerationResult } from '../../lib/ai/types';

export function ModerationQueue() {
  const [items, setItems] = useState<Array<ModerationResult & { publication?: { id: string; title: string; slug: string } }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_moderation_results')
        .select(`
          *,
          publication:publications(id, title, slug)
        `)
        .eq('requires_human_review', true)
        .is('reviewed_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      type RawItem = ModerationResult & {
        publication: Array<{ id: string; title: string; slug: string }> | null;
      };

      setItems(
        (data as RawItem[])?.map((item) => ({
          ...item,
          publication: Array.isArray(item.publication) ? item.publication[0] : undefined,
        })) || []
      );
    } catch (error) {
      console.error('Error loading moderation queue:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(itemId: string, decision: 'APPROVED' | 'REJECTED') {
    try {
      const { data: userResponse } = await supabase.auth.getUser();
      const user = userResponse.user;

      if (!user) return;

      await supabase
        .from('ai_moderation_results')
        .update({
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_decision: decision,
        })
        .eq('id', itemId);

      // Recargar cola
      loadQueue();
    } catch (error) {
      console.error('Error reviewing item:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-foreground/20 border-t-orange" />
          <p className="text-sm font-semibold text-foreground/70">Cargando cola...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-foreground/10 bg-surface p-8 text-center">
        <CheckCircle className="size-12 text-found mx-auto mb-3" />
        <h3 className="font-display text-lg font-bold text-foreground mb-2">
          ¡Todo revisado!
        </h3>
        <p className="text-foreground/70">
          No hay contenido pendiente de moderación manual.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-foreground">
          Cola de moderación
        </h2>
        <span className="rounded-full bg-orange/20 px-3 py-1 text-sm font-bold text-orange-dark">
          {items.length} pendientes
        </span>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border-2 border-foreground/10 bg-surface p-5 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <AlertTriangle className="size-6 text-orange" />
            </div>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${getClassificationStyles(item.classification)}`}
                    >
                      {getClassificationLabel(item.classification)}
                    </span>
                    <span className="text-xs text-foreground/60">
                      {Math.round(item.confidence * 100)}% confianza
                    </span>
                  </div>

                  {item.publication && (
                    <a
                      href={`/p/${item.publication.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-display font-bold text-foreground hover:text-purple transition-colors inline-flex items-center gap-1"
                    >
                      {item.publication.title}
                      <Eye className="size-4" />
                    </a>
                  )}
                </div>

                <span className="text-xs text-foreground/50">
                  {new Date(item.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Reason */}
              {item.reason && (
                <div className="mb-4 p-3 rounded-xl bg-orange/5 border border-orange/20">
                  <p className="text-sm text-foreground/80">
                    <strong className="font-semibold">Razón:</strong> {item.reason}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => handleReview(item.id, 'APPROVED')}
                  className="h-9 px-4 text-sm gap-2 bg-found hover:bg-found-dark"
                >
                  <CheckCircle className="size-4" />
                  Aprobar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleReview(item.id, 'REJECTED')}
                  className="h-9 px-4 text-sm gap-2 bg-lost/10 hover:bg-lost/20 text-lost"
                >
                  <XCircle className="size-4" />
                  Rechazar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getClassificationLabel(classification: string): string {
  const labels: Record<string, string> = {
    SPAM: 'Spam',
    FRAUD: 'Fraude',
    OFFENSIVE: 'Ofensivo',
    INAPPROPRIATE: 'Inapropiado',
    UNRELATED: 'No relacionado',
    UNCERTAIN: 'Incierto',
    SAFE: 'Seguro',
  };
  return labels[classification] || classification;
}

function getClassificationStyles(classification: string): string {
  const styles: Record<string, string> = {
    SPAM: 'bg-orange/20 text-orange-dark',
    FRAUD: 'bg-lost/20 text-lost',
    OFFENSIVE: 'bg-lost/20 text-lost',
    INAPPROPRIATE: 'bg-orange/20 text-orange-dark',
    UNRELATED: 'bg-foreground/10 text-foreground',
    UNCERTAIN: 'bg-purple/20 text-purple-dark',
    SAFE: 'bg-found/20 text-found',
  };
  return styles[classification] || 'bg-foreground/10 text-foreground';
}
