import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, PawPrint, RefreshCw } from 'lucide-react';
import { useAuth } from '../app/auth-context';
import { Button, LinkButton } from '../components/ui/button';
import { CatLoader } from '../components/ui/cat-loader';
import { EmptyState } from '../components/ui/empty-state';
import { StatusBadge } from '../components/ui/status-badge';
import { supabase } from '../lib/supabase/client';
import { chatErrorMessage, getConversations, subscribeToInbox, type ConversationSummary } from '../lib/supabase/chat';
import { formatRelativeChatTime } from '../lib/utils/chat-format';
import { setPageMeta } from '../lib/seo/page-meta';

type InboxFilter = 'all' | 'unread';

function coverUrl(storagePath: string | null): string | null {
  if (!storagePath) {
    return null;
  }

  return supabase.storage.from('pet-images').getPublicUrl(storagePath).data.publicUrl;
}

export function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showSpinner = false) => {
      if (!userId) {
        setConversations([]);
        setLoading(false);
        return;
      }

      if (showSpinner) {
        setLoading(true);
      }

      try {
        const data = await getConversations();
        setConversations(data);
        setError(null);
      } catch (loadError) {
        setError(chatErrorMessage(loadError, 'No pudimos cargar tus mensajes.'));
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    setPageMeta({
      title: 'Mensajes — Patitas',
      description: 'Conversaciones sobre tus publicaciones de mascotas.',
      canonicalPath: '/mensajes',
      noindex: true,
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    void load(true);
  }, [authLoading, userId, load]);

  // La bandeja se mantiene al día sin recargar la página.
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToInbox(() => {
      void load();
    });

    return unsubscribe;
  }, [userId, load]);

  const unreadTotal = conversations.reduce((total, item) => total + item.unread_count, 0);
  const visibleConversations =
    filter === 'unread'
      ? conversations.filter((item) => item.unread_count > 0)
      : conversations;

  if (authLoading) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10">
        <CatLoader size="lg" />
        <p className="font-display text-lg font-semibold text-foreground">Cargando mensajes...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border-2 border-foreground/10 bg-surface p-8 text-center shadow-md">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-turquoise/10">
            <MessageCircle className="size-8 text-turquoise" aria-hidden="true" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
            Tus mensajes, en un solo lugar
          </h1>
          <p className="mx-auto mt-3 max-w-md text-foreground/70">
            Inicia sesión para hablar con el dueño de una publicación. Las conversaciones quedan
            guardadas y solo las ven sus participantes.
          </p>
          <div className="mt-6 flex justify-center">
            <LinkButton href={`/auth/login?next=${encodeURIComponent('/mensajes')}`}>
              Iniciar sesión
            </LinkButton>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 py-8">
      <div className="relative overflow-hidden rounded-3xl border-2 border-foreground/10 bg-linear-to-br from-turquoise/10 via-app to-orange/10 p-8 shadow-md">
        <div className="blob-decoration absolute right-5 top-5 size-24 bg-turquoise/20" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MessageCircle className="size-5 text-turquoise" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                Conversaciones
              </span>
            </div>
            <h1 className="font-display text-4xl font-extrabold text-foreground">Mensajes</h1>
            <p className="mt-1 text-foreground/60">
              {unreadTotal > 0
                ? `Tienes ${unreadTotal} mensaje${unreadTotal === 1 ? '' : 's'} sin leer`
                : 'Estás al día'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => void load(true)} className="gap-2">
            <RefreshCw className="size-4" aria-hidden="true" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={[
            'rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-base',
            filter === 'all'
              ? 'bg-ink text-white shadow-md'
              : 'border-2 border-foreground/10 bg-surface text-foreground/70 hover:bg-foreground/5',
          ].join(' ')}
        >
          Todas ({conversations.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={[
            'rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-base',
            filter === 'unread'
              ? 'bg-ink text-white shadow-md'
              : 'border-2 border-foreground/10 bg-surface text-foreground/70 hover:bg-foreground/5',
          ].join(' ')}
        >
          Sin leer ({unreadTotal})
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-lost/20 bg-lost/10 px-4 py-3 text-sm font-medium text-lost-dark">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CatLoader size="lg" />
          <p className="font-display text-lg font-semibold text-foreground">Cargando conversaciones...</p>
        </div>
      ) : visibleConversations.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No tienes mensajes sin leer' : 'Todavía no tienes conversaciones'}
          description={
            filter === 'unread'
              ? 'Cuando alguien te escriba o respondas un hilo, aparecerá aquí.'
              : 'Abre una publicación y escribe al dueño. La conversación quedará anclada a ese caso.'
          }
          illustration="cat"
          action={
            filter === 'unread' ? (
              <Button variant="secondary" onClick={() => setFilter('all')}>
                Ver todas las conversaciones
              </Button>
            ) : (
              <LinkButton href="/buscar">Buscar mascotas</LinkButton>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {visibleConversations.map((conversation) => {
            const image = coverUrl(conversation.cover_storage_path);
            const hasUnread = conversation.unread_count > 0;

            return (
              <Link
                key={conversation.conversation_id}
                to={`/mensajes/${conversation.conversation_id}`}
                className={[
                  'group flex gap-4 rounded-2xl border-2 bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                  hasUnread ? 'border-orange/40 bg-orange/5' : 'border-foreground/10',
                ].join(' ')}
              >
                <div className="size-16 shrink-0 overflow-hidden rounded-2xl border-2 border-foreground/10 bg-foreground/5">
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center" aria-hidden="true">
                      <PawPrint className="size-7 text-foreground/30" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-bold text-foreground">
                        {conversation.publication_title}
                      </p>
                      <p className="truncate text-xs font-semibold text-foreground/50">
                        @{conversation.other_username ?? 'usuario'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {conversation.last_message_at ? (
                        <time
                          className="text-xs font-medium text-foreground/50"
                          dateTime={conversation.last_message_at}
                        >
                          {formatRelativeChatTime(conversation.last_message_at)}
                        </time>
                      ) : null}
                      {hasUnread ? (
                        <span className="flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-orange px-1.5 text-[11px] font-bold text-white">
                          {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p
                    className={[
                      'mt-1 line-clamp-2 text-sm',
                      hasUnread ? 'font-semibold text-foreground' : 'text-foreground/70',
                    ].join(' ')}
                  >
                    {conversation.last_message_body ?? 'Conversación nueva. Escribe el primer mensaje.'}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={conversation.publication_type} />
                    {conversation.archived_at ? (
                      <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-bold text-foreground/60">
                        Cerrada
                      </span>
                    ) : null}
                    {!conversation.publication_available ? (
                      <span className="rounded-full bg-lost/10 px-2.5 py-1 text-[11px] font-bold text-lost-dark">
                        Publicación no disponible
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default MessagesPage;
