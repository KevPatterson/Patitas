import { safeLinkUrl } from '../../lib/utils/safe-url';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Eye, Edit, Star, Image, Globe, Shield, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../ui/button';
import { infoDialog, notifyError, notifySuccess, promptText } from '../../lib/ui/sweetalert';
import type { ExternalPost, ExternalSource } from '../../types/index';

const CONFIDENCE_THRESHOLD_AUTO = 0.85;

type ReviewPublication = {
  publication_images?: Array<{ storage_path: string; is_cover: boolean | null }> | null;
};

type ReviewItem = ExternalPost & { source?: ExternalSource; publication?: ReviewPublication | null };

export function PendingReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  // URLs firmadas de las imágenes de staging (bucket privado `external-imports`)
  const [stagingUrls, setStagingUrls] = useState<Record<string, string>>({});

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
          source:external_sources(*),
          publication:publications(publication_images(storage_path, is_cover))
        `)
        .eq('status', 'PENDING_REVIEW')
        .order('fetched_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const queue = (posts as ReviewItem[]) || [];
      setItems(queue);

      // Solo se firman las que no tienen copia pública en pet-images: el bucket
      // `external-imports` es privado y su URL pública devuelve error.
      const stagingPaths = queue
        .filter((post) => (post.publication?.publication_images?.length ?? 0) === 0)
        .flatMap((post) => post.image_paths ?? []);

      if (stagingPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from('external-imports')
          .createSignedUrls([...new Set(stagingPaths)], 3600);
        const map: Record<string, string> = {};
        for (const item of signed ?? []) {
          if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
        }
        setStagingUrls(map);
      } else {
        setStagingUrls({});
      }
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
    await infoDialog({
      title: 'Edición en camino',
      text: 'Todavía estamos preparando el editor de importaciones. Por ahora puedes aprobar el post tal como llegó o rechazarlo indicando el motivo.',
    });
  }

  async function handleReject(postId: string) {
    const reason = await promptText({
      title: 'Motivo del rechazo',
      text: 'Se guardará en el historial para que otros moderadores entiendan la decisión.',
      placeholder: 'Ej.: la foto no corresponde a la mascota o faltan datos clave.',
      confirmText: 'Rechazar importación',
      cancelText: 'Cancelar',
      minLength: 5,
      maxLength: 300,
      tone: 'danger',
    });
    if (reason === null) return;

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
      notifySuccess('Fuente marcada como confiable', 'Las próximas importaciones podrán publicarse automáticamente.');
    } catch (error) {
      console.error('Error marking source as trusted:', error);
      notifyError('No se pudo marcar la fuente', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDecision(postId: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    setActionLoadingId(postId);
    try {
      // Endpoint correcto: /api/admin?resource=moderation en Vercel (con JWT de sesión).
      // Antes se llamaba a supabase.functions.invoke('admin-moderation'), que
      // apunta a una Edge Function de Supabase inexistente: la cola nunca pudo
      // aprobar ni rechazar importaciones.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('No hay sesión activa');

      const action = decision === 'APPROVE' ? 'approve-import' : 'reject-import';
      const response = await fetch('/api/admin?resource=moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, id: postId, reason }),
      });

      // `npm run dev` (Vite) no sirve las rutas de `api/`: responde el index.html
      // de la SPA con un 404, y `response.json()` fallaba con un SyntaxError
      // ("Unexpected end of JSON input") que ocultaba la causa real.
      const contentType = response.headers.get('content-type') ?? '';
      const isJson = contentType.includes('application/json');

      if (response.status === 404 && !isJson) {
        throw new Error(
          'El endpoint /api/admin?resource=moderation no está disponible en este servidor. ' +
            'Arranca el proyecto con `vercel dev` (npm run dev no sirve /api/*) o prueba en producción.'
        );
      }

      if (!isJson) {
        throw new Error(`Respuesta inesperada del servidor (HTTP ${response.status}).`);
      }

      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(result.error ?? result.message ?? `Error en la acción (HTTP ${response.status})`);
      }

      await loadQueue();
      notifySuccess(
        decision === 'APPROVE' ? 'Importación aprobada' : 'Importación rechazada',
        decision === 'APPROVE'
          ? 'La publicación ya está visible en el sitio.'
          : 'El post quedó descartado de la cola.'
      );
    } catch (error) {
      console.error('Error processing decision:', error);
      if (error instanceof TypeError) {
        // Fallo de red: fetch lanza TypeError cuando no hay conexión con el servidor.
        notifyError(
          'Sin conexión con el servidor',
          'Revisa tu conexión e inténtalo de nuevo.'
        );
        return;
      }
      notifyError(
        'No se pudo procesar la decisión',
        error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.'
      );
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
          // Las imágenes ya copiadas viven en pet-images (bucket público). Las
          // del staging (external-imports) son privadas: se muestran con la URL
          // firmada que se obtiene en loadQueue.
          const publicationImages = post.publication?.publication_images ?? [];
          const reviewImages = publicationImages.length > 0
            ? publicationImages.map((image) => ({
                url: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/pet-images/${image.storage_path}`,
                key: image.storage_path,
              }))
            : (post.image_paths ?? [])
                .map((path) => ({ url: stagingUrls[path] ?? '', key: path }))
                .filter((image) => image.url.length > 0);
          // `hasImages` debe reflejar lo que realmente se puede mostrar, no el
          // staging en bruto: si no hay portada visible, no se pinta la galería.
          const hasImages = reviewImages.length > 0;
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
                      <p className="text-xs text-foreground/50 mb-2">Imágenes ({reviewImages.length}):</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {reviewImages.slice(0, 6).map((image, idx) => (
                          <div key={image.key} className="relative aspect-square rounded-lg overflow-hidden border border-foreground/10">
                            <img
                              src={image.url}
                              alt={`Imagen ${idx + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                        {reviewImages.length > 6 && (
                          <div className="relative aspect-square rounded-lg bg-foreground/5 border border-foreground/10 flex items-center justify-center">
                            <span className="text-xs text-foreground/60">+{reviewImages.length - 6} más</span>
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
                  onClick={() => handleReject(post.id)}
                  disabled={actionLoadingId === post.id}
                  className="h-9 px-4 text-sm gap-2"
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