import { safeLinkUrl } from '../../lib/utils/safe-url';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Eye, Edit, Star, Image, Globe, Shield, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../ui/button';
import type { ExternalPost, ExternalSource } from '../../types/index';

const CONFIDENCE_THRESHOLD_AUTO = 0.85;

export function PendingReviewQueue() {
  const [items, setItems] = useState<Array<ExternalPost & { source?: ExternalSource }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      // Obtener posts pendientes de revisión
      const { data: posts, error } = await supabase
        .from('external_posts')
        .select(`
          *,
          source:external_sources(*)
        `)
        .eq('status', 'PENDING_REVIEW')
        .order('fetched_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setItems((posts as Array<ExternalPost & { source?: ExternalSource }>) || []);
    } catch (error) {
      console.error('Error loading pending review queue:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(postId: string) {
    await handleDecision(postId, 'APPROVE');
  }

  async function handleEditAndApprove(_postId: string) {
    // TODO: Abrir modal de edición
    alert('Función "Editar y aprobar" pendiente - abrir editor con datos extraídos');
  }

  async function handleReject(postId: string, reason: string) {
    await handleDecision(postId, 'REJECT', reason);
  }

  async function handleMarkTrusted(postId: string) {
    setActionLoadingId(postId);
    try {
      const post = items.find(p => p.id === postId);
      if (!post?.source_id) return;

      // Marcar fuente como confiable
      const { error } = await supabase
        .from('external_sources')
        .update({ is_trusted: true })
        .eq('id', post.source_id);

      if (error) throw error;

      // Recargar
      await loadQueue();
    } catch (error) {
      console.error('Error marking source as trusted:', error);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDecision(postId: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    setActionLoadingId(postId);
    try {
      const { error } = await supabase.functions.invoke('admin-moderation', {
        body: {
          action: decision === 'APPROVE' ? 'approve-import' : 'reject-import',
          id: postId,
          reason,
        },
      });

      if (error) throw error;

      await loadQueue();
    } catch (error) {
      console.error('Error processing decision:', error);
      alert('Error procesando la decisión');
    } finally {
      setActionLoadingId(null);
    }
  }


  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.7) return 'bg-found/10 text-found';
    if (confidence >= 0.4) return 'bg-orange/10 text-orange';
    return 'bg-lost/10 text-lost';
  }

  function getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.7) return 'Alta';
    if (confidence >= 0.4) return 'Media';
    return 'Baja';
  }

  function getPlatformIcon(platform: 'TELEGRAM' | 'FACEBOOK_PUBLIC'): React.ReactNode {
    if (platform === 'TELEGRAM') return <Globe className="size-4 text-orange" />;
    return <Image className="size-4 text-orange" />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 text-orange animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="size-16 text-foreground/20 mx-auto mb-4" />
        <h3 className="font-display text-lg font-bold text-foreground">No hay posts pendientes</h3>
        <p className="text-foreground/60 mt-1">Todos los posts importados han sido revisados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-foreground">
          Cola de revisión de importaciones
        </h2>
        <span className="rounded-full bg-orange/20 px-3 py-1 text-sm font-bold text-orange-dark">
          {items.length} pendientes
        </span>
      </div>

      <div className="space-y-4">
        {items.map((post) => {
          const extracted = post.extracted as Record<string, unknown>;
          const hasImages = post.image_paths.length > 0;
          const sourceTrusted = post.source?.is_trusted ?? false;
          const canAutoPublish = post.confidence >= CONFIDENCE_THRESHOLD_AUTO && sourceTrusted && hasImages && !!extracted.province;

          return (
            <div
              key={post.id}
              className="rounded-2xl border-2 border-foreground/10 bg-surface p-5 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-secondary flex items-center justify-center">
                    {getPlatformIcon(post.platform)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">
                        {post.source?.name ?? post.source?.handle_or_url ?? 'Fuente desconocida'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getConfidenceColor(post.confidence)}`}
                      >
                        {getConfidenceLabel(post.confidence)} ({Math.round(post.confidence * 100)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-foreground/60">
                      <span>Post original:</span>
                      <a
                        href={safeLinkUrl(post.source_url) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer nofollow ugc"
                        className="hover:underline text-orange truncate max-w-xs inline-block"
                      >
                        {post.external_id}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground/50">
                    {new Date(post.fetched_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {canAutoPublish && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-found/10 text-found">
                      <Star className="size-3" />
                      Auto-publicable
                    </span>
                  )}
                  {sourceTrusted && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-purple/10 text-purple-700">
                      <Shield className="size-3" />
                      Fuente confiable
                    </span>
                  )}
                </div>
              </div>

              {/* Side-by-side: Original vs Extraído */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Columna izquierda: Contenido original */}
                <div className="rounded-xl bg-foreground/5 border border-foreground/10 p-4">
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="size-4 text-orange" />
                    Contenido original
                  </h4>
                  
                  {post.raw_text && (
                    <div className="mb-4">
                      <p className="text-xs text-foreground/50 mb-1">Texto completo:</p>
                      <div className="whitespace-pre-wrap text-sm text-foreground/80 max-h-48 overflow-auto bg-surface/50 p-3 rounded-lg border border-foreground/10">
                        {post.raw_text}
                      </div>
                    </div>
                  )}

                  {hasImages && (
                    <div>
                      <p className="text-xs text-foreground/50 mb-2">Imágenes ({post.image_paths.length}):</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {post.image_paths.slice(0, 6).map((imgPath, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-foreground/10">
                            <img
                              src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/external-imports/${imgPath}`}
                              alt={`Imagen ${idx + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                        {post.image_paths.length > 6 && (
                          <div className="relative aspect-square rounded-lg bg-foreground/5 border border-foreground/10 flex items-center justify-center">
                            <span className="text-xs text-foreground/60">+{post.image_paths.length - 6} más</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Columna derecha: Datos extraídos */}
                <div className="rounded-xl bg-found/5 border border-green/10 p-4">
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <CheckCircle className="size-4 text-found" />
                    Datos extraídos por IA
                  </h4>
                  
                  <div className="space-y-3 max-h-[400px] overflow-auto">
                    {Object.entries(extracted).map(([key, value]) => {
                      if (value === null || value === undefined || value === '') return null;
                      if (key === 'confidence') return null;

                      const fieldConfidence = (extracted.confidence as Record<string, number>)?.[key] ?? 0;
                      const label = key
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase());

                      return (
                        <div key={key} className="bg-surface/50 rounded-xl p-3 border border-foreground/10">
                          <label className="block text-xs font-semibold text-foreground/60 mb-1 flex items-center gap-1">
                            {label}
                            {fieldConfidence > 0 && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs font-medium ${getConfidenceColor(fieldConfidence)}`}
                                title={`Confidence: ${Math.round(fieldConfidence * 100)}%`}
                              >
                                {Math.round(fieldConfidence * 100)}%
                              </span>
                            )}
                          </label>
                          <div className="font-medium text-foreground text-sm">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-foreground/10">
                <Button
                  variant="primary"
                  onClick={() => handleApprove(post.id)}
                  disabled={actionLoadingId === post.id}
                  loading={actionLoadingId === post.id}
                  className="h-9 px-4 text-sm gap-2 bg-found hover:bg-found-dark"
                >
                  <CheckCircle className="size-4" />
                  Aprobar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleEditAndApprove(post.id)}
                  disabled={actionLoadingId === post.id}
                  className="h-9 px-4 text-sm gap-2"
                >
                  <Edit className="size-4" />
                  Editar y aprobar
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    const reason = prompt('Motivo del rechazo:');
                    if (reason) handleReject(post.id, reason);
                  }}
                  disabled={actionLoadingId === post.id}
                  className="h-9 px-4 text-sm gap-2 bg-lost/10 hover:bg-lost/20 text-lost"
                >
                  <XCircle className="size-4" />
                  Rechazar
                </Button>
                {!sourceTrusted && post.source_id && (
                  <Button
                    variant="ghost"
                    onClick={() => handleMarkTrusted(post.id)}
                    disabled={actionLoadingId === post.id}
                    className="h-9 px-4 text-sm gap-2"
                  >
                    <Star className="size-4" />
                    Marcar fuente confiable
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    const target = safeLinkUrl(post.source_url);
                    if (target) window.open(target, '_blank', 'noopener,noreferrer');
                  }}
                  className="h-9 px-4 text-sm gap-2"
                >
                  <Eye className="size-4" />
                  Ver original
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PendingReviewQueue;