import { useEffect, useState } from 'react';
import { MessageCircle, Trash2, PawPrint, Edit2, X, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { TextareaField } from '../ui/textarea-field';
import { createComment, deleteComment, updateComment, getComments, type Comment } from '../../lib/supabase/comments';

type CommentsSectionProps = {
  publicationId: string;
  currentUserId: string | null;
};

function formatRelativeTime(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return new Intl.DateTimeFormat('es-CU', { dateStyle: 'short' }).format(past);
}

export function CommentsSection({ publicationId, currentUserId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [editingError, setEditingError] = useState<string | null>(null);

  const loadComments = async () => {
    try {
      const data = await getComments(publicationId);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicationId]);

  const handleSubmit = async () => {
    if (!currentUserId) {
      setErrorMessage('Necesitas entrar para comentar.');
      return;
    }

    if (!body.trim() || body.trim().length < 3) {
      setErrorMessage('El comentario debe tener al menos 3 caracteres.');
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      await createComment(publicationId, currentUserId, body);
      setBody('');
      await loadComments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos publicar tu comentario.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!currentUserId) return;
    
    if (!confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
      return;
    }

    try {
      await deleteComment(commentId, currentUserId);
      await loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
    setEditingError(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingBody('');
    setEditingError(null);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!currentUserId) return;

    if (!editingBody.trim() || editingBody.trim().length < 3) {
      setEditingError('El comentario debe tener al menos 3 caracteres.');
      return;
    }

    setEditingError(null);

    try {
      await updateComment(commentId, currentUserId, editingBody);
      setEditingCommentId(null);
      setEditingBody('');
      await loadComments();
    } catch (error) {
      setEditingError(error instanceof Error ? error.message : 'No pudimos actualizar el comentario.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con personalidad */}
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-turquoise/10 border-2 border-turquoise/20">
            <MessageCircle className="h-5 w-5 text-turquoise" />
          </div>
          <h3 className="font-display text-2xl font-extrabold text-foreground">Comentarios</h3>
          {comments.length > 0 && (
            <span className="rounded-pill bg-orange/10 border border-orange/20 px-3 py-1.5 text-sm font-bold text-orange shadow-sm">
              {comments.length}
            </span>
          )}
        </div>
        {/* Decoración de huella */}
        <div className="absolute -top-2 -right-2 text-orange/10 animate-float">
          <PawPrint className="h-8 w-8" />
        </div>
      </div>

      {/* Formulario para comentar */}
      {currentUserId ? (
        <div className="group relative overflow-hidden rounded-2xl border-2 border-turquoise/30 bg-surface p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:border-turquoise/40">
          {/* Blob decorativo */}
          <div className="blob-decoration absolute -top-10 -right-10 w-32 h-32 bg-turquoise/10" />
          
          <div className="relative space-y-4">
            <TextareaField
              label="Agregar comentario"
              placeholder="Comparte información útil sobre este caso... 🐾"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />

            {errorMessage && (
              <div className="rounded-xl bg-lost/10 border-2 border-lost/20 px-4 py-3 flex items-start gap-2 animate-shake">
                <span className="text-lost text-lg">⚠️</span>
                <p className="text-sm font-medium text-lost-dark leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            )}

            <Button 
              type="button" 
              onClick={handleSubmit} 
              disabled={submitting}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <span className="inline-flex gap-1">
                    <span className="animate-paw-pulse">•</span>
                    <span className="animate-paw-pulse" style={{ animationDelay: '0.2s' }}>•</span>
                    <span className="animate-paw-pulse" style={{ animationDelay: '0.4s' }}>•</span>
                  </span>
                  Enviando
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" />
                  Publicar comentario
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-foreground/10 bg-foreground/5 p-6 text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center mx-auto mb-3">
            <MessageCircle className="h-6 w-6 text-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-foreground/60">
            🔒 Necesitas iniciar sesión para comentar
          </p>
          <p className="text-xs text-foreground/40">
            Únete a la comunidad y ayuda a reunir patitas
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-2xl border-2 border-foreground/10 bg-surface p-8 text-center space-y-3">
          <div className="flex justify-center gap-2">
            <PawPrint className="h-6 w-6 text-orange animate-paw-pulse" />
            <PawPrint className="h-6 w-6 text-turquoise animate-paw-pulse" style={{ animationDelay: '0.2s' }} />
            <PawPrint className="h-6 w-6 text-purple animate-paw-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <p className="text-sm font-medium text-foreground/60">
            Cargando comentarios...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && comments.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-foreground/20 bg-foreground/5 p-10 text-center space-y-3">
          {/* Decoración */}
          <div className="absolute top-4 left-4 text-foreground/5">
            <PawPrint className="h-12 w-12 rotate-12" />
          </div>
          <div className="absolute bottom-4 right-4 text-foreground/5">
            <PawPrint className="h-12 w-12 -rotate-12" />
          </div>
          
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-foreground/10 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-8 w-8 text-foreground/30" />
            </div>
            <p className="font-display text-lg font-bold text-foreground/60 mb-1">
              Aún no hay comentarios
            </p>
            <p className="text-sm text-foreground/40">
              Sé el primero en compartir información útil 🐾
            </p>
          </div>
        </div>
      )}

      {/* Lista de comentarios */}
      <div className="space-y-4">
        {comments.map((comment, index) => (
          <div
            key={comment.id}
            className="group relative overflow-hidden rounded-2xl border-2 border-foreground/10 bg-surface p-5 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-turquoise/30"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Barra lateral de color */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-turquoise to-purple opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1 min-w-0">
                {/* Avatar mejorado */}
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-orange via-turquoise to-purple text-lg font-display font-extrabold text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                  {comment.author?.username?.[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Contenido */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-extrabold text-foreground">
                      @{comment.author?.username ?? 'Usuario'}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                      <PawPrint className="h-2.5 w-2.5" />
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  
                  {/* Mostrar textarea si está editando, de lo contrario mostrar el texto */}
                  {editingCommentId === comment.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        className="w-full min-h-20 rounded-xl border-2 border-turquoise/30 bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:border-turquoise focus:ring-4 focus:ring-turquoise/20 resize-y"
                        placeholder="Edita tu comentario..."
                      />
                      {editingError && (
                        <p className="text-xs font-medium text-lost">{editingError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(comment.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-turquoise hover:bg-turquoise-dark border border-turquoise-dark px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:scale-105"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/10 hover:bg-ink/20 border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 hover:scale-105"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {comment.body}
                    </p>
                  )}
                </div>
              </div>

              {/* Botones de acción (editar y eliminar) */}
              {comment.author && currentUserId === comment.author_profile_id && editingCommentId !== comment.id && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(comment)}
                    className="group/btn flex items-center gap-1.5 rounded-lg bg-turquoise/10 hover:bg-turquoise/20 border border-turquoise/20 hover:border-turquoise/30 px-3 py-1.5 text-xs font-semibold text-turquoise transition-all duration-200 hover:scale-105"
                    aria-label="Editar comentario"
                  >
                    <Edit2 className="h-3.5 w-3.5 transition-transform group-hover/btn:scale-110" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    className="group/btn flex items-center gap-1.5 rounded-lg bg-lost/10 hover:bg-lost/20 border border-lost/20 hover:border-lost/30 px-3 py-1.5 text-xs font-semibold text-lost transition-all duration-200 hover:scale-105"
                    aria-label="Eliminar comentario"
                  >
                    <Trash2 className="h-3.5 w-3.5 transition-transform group-hover/btn:scale-110" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
