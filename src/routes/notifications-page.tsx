import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  Flag,
  Heart,
  MessageCircle,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../app/auth-context';
import { Button, LinkButton } from '../components/ui/button';
import { CatLoader } from '../components/ui/cat-loader';
import { EmptyState, ErrorState } from '../components/ui/empty-state';
import {
  NOTIFICATIONS_PAGE_SIZE,
  deleteNotification,
  getNotifications,
  getNotificationsOverview,
  markAllAsRead,
  markAsRead,
  subscribeToNotifications,
  type Notification,
} from '../lib/supabase/notifications';
import { invalidateNotificationCountCache } from '../lib/hooks/use-notification-count';
import { confirmDialog, notifyError, notifyInfo, notifySuccess } from '../lib/ui/sweetalert';
import { setPageMeta } from '../lib/seo/page-meta';
import { safeInternalPath } from '../lib/utils/safe-url';

type Filter = 'all' | 'unread';

type ViewState = {
  items: Notification[];
  /** Total de filas del filtro activo (no solo las cargadas). */
  total: number;
  /** Total sin filtro, para la pestaña "Todas". */
  allTotal: number;
  /** Total sin leer, para la pestaña "Sin leer" y la cabecera. */
  unread: number;
};

const EMPTY_VIEW: ViewState = { items: [], total: 0, allTotal: 0, unread: 0 };

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 31_536_000 },
  { unit: 'month', seconds: 2_592_000 },
  { unit: 'week', seconds: 604_800 },
  { unit: 'day', seconds: 86_400 },
  { unit: 'hour', seconds: 3_600 },
  { unit: 'minute', seconds: 60 },
];

/** Fecha relativa con granularidad de minutos/horas, no solo de días. */
function formatRelativeDate(iso: string): string {
  const timestamp = Date.parse(iso);

  if (Number.isNaN(timestamp)) return '';

  const diffSeconds = Math.round((timestamp - Date.now()) / 1_000);
  const absolute = Math.abs(diffSeconds);

  if (absolute < 45) return 'Ahora mismo';

  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (absolute >= seconds) {
      return relativeFormatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute');
}

function formatFullDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onlyUnread = filter === 'unread';
  const onlyUnreadRef = useRef(onlyUnread);

  useEffect(() => {
    onlyUnreadRef.current = onlyUnread;
  }, [onlyUnread]);

  const loadPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (!userId) return;

      if (replace) {
        setInitialLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const [page, overview] = await Promise.all([
          getNotifications({
            limit: NOTIFICATIONS_PAGE_SIZE,
            offset,
            onlyUnread,
          }),
          replace ? getNotificationsOverview() : Promise.resolve(null),
        ]);

        setView((prev) => {
          if (replace) {
            return {
              items: page.items,
              total: page.total,
              allTotal: overview?.total ?? page.total,
              unread: overview?.unread ?? prev.unread,
            };
          }

          const seen = new Set(prev.items.map((item) => item.id));

          return {
            ...prev,
            items: [...prev.items, ...page.items.filter((item) => !seen.has(item.id))],
            total: page.total,
          };
        });
      } catch (loadError) {
        console.error('Error al cargar las notificaciones:', loadError);

        if (replace) {
          setError(errorMessage(loadError, 'No se pudieron cargar las notificaciones.'));
        } else {
          notifyError(
            'No se pudieron cargar más notificaciones',
            errorMessage(loadError, 'Inténtalo de nuevo.')
          );
        }
      } finally {
        if (replace) {
          setInitialLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [userId, onlyUnread]
  );

  useEffect(() => {
    setPageMeta({
      title: 'Notificaciones — Patitas',
      description: 'Revisa tus notificaciones y actualizaciones sobre tus publicaciones.',
      canonicalPath: '/notificaciones',
    });
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Al cambiar de usuario o de filtro se descarta lo anterior para no mostrar
    // notificaciones de otra sesión ni mezclar "todas" con "sin leer".
    setView(EMPTY_VIEW);
    void loadPage(0, true);
  }, [userId, loadPage]);

  /**
   * Tiempo real. Si Realtime falla, la página sigue funcionando con el
   * reintento del estado de error y con el polling del badge de la cabecera.
   */
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToNotifications(userId, {
      onInsert: (notification) => {
        setView((prev) => {
          if (prev.items.some((item) => item.id === notification.id)) return prev;

          const hiddenByFilter = onlyUnreadRef.current && notification.is_read;

          return {
            items: hiddenByFilter ? prev.items : [notification, ...prev.items],
            total: hiddenByFilter ? prev.total : prev.total + 1,
            allTotal: prev.allTotal + 1,
            unread: prev.unread + (notification.is_read ? 0 : 1),
          };
        });
        invalidateNotificationCountCache();
      },
      onUpdate: (notification) => {
        setView((prev) => {
          const previous = prev.items.find((item) => item.id === notification.id);

          if (!previous) return prev;

          const wasUnread = !previous.is_read;
          const isUnread = !notification.is_read;
          const removed = onlyUnreadRef.current && !isUnread;

          return {
            items: removed
              ? prev.items.filter((item) => item.id !== notification.id)
              : prev.items.map((item) => (item.id === notification.id ? notification : item)),
            total: removed ? Math.max(0, prev.total - 1) : prev.total,
            allTotal: prev.allTotal,
            unread: Math.max(0, prev.unread + (wasUnread ? -1 : 0) + (isUnread ? 1 : 0)),
          };
        });
        invalidateNotificationCountCache();
      },
      onDelete: (notification) => {
        setView((prev) => {
          const deleted = prev.items.find((item) => item.id === notification.id);

          // Si el evento llega después de borrar en esta pestaña, el estado ya
          // está actualizado: no se descuenta dos veces.
          if (!deleted) return prev;

          return {
            items: prev.items.filter((item) => item.id !== notification.id),
            total: Math.max(0, prev.total - 1),
            allTotal: Math.max(0, prev.allTotal - 1),
            unread: deleted.is_read ? prev.unread : Math.max(0, prev.unread - 1),
          };
        });
        invalidateNotificationCountCache();
      },
    });

    return unsubscribe;
  }, [userId]);

  /**
   * Cambiar de pestaña limpia la lista en el mismo evento, antes de que React
   * pinte. Si solo se cambiara `filter`, el efecto de carga corre después del
   * pintado y se vería un fotograma con las notificaciones del filtro anterior
   * bajo la pestaña nueva.
   */
  const changeFilter = (next: Filter) => {
    if (next === filter) return;

    setView(EMPTY_VIEW);
    setInitialLoading(true);
    setError(null);
    setFilter(next);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    const target = view.items.find((item) => item.id === notificationId);

    if (!target || target.is_read) return;

    setPendingId(notificationId);

    try {
      const changed = await markAsRead(notificationId);

      // Aunque no cambie nada (ya estaba leída en otra pestaña), el badge puede
      // estar desfasado: se invalida igualmente.
      invalidateNotificationCountCache();

      if (!changed) return;

      setView((prev) => {
        const current = prev.items.find((item) => item.id === notificationId);

        if (!current || current.is_read) return prev;

        return {
          ...prev,
          items: onlyUnread
            ? prev.items.filter((item) => item.id !== notificationId)
            : prev.items.map((item) =>
                item.id === notificationId
                  ? { ...item, is_read: true, read_at: new Date().toISOString() }
                  : item
              ),
          total: onlyUnread ? Math.max(0, prev.total - 1) : prev.total,
          unread: Math.max(0, prev.unread - 1),
        };
      });
    } catch (markError) {
      notifyError(
        'No se pudo marcar como leída',
        errorMessage(markError, 'Inténtalo de nuevo en unos segundos.')
      );
    } finally {
      setPendingId(null);
    }
  };

  /**
   * Al abrir el enlace se marca como leída sin bloquear la navegación. El
   * evento de Realtime confirma el cambio; si falla, al recargar sigue sin leer.
   */
  const handleOpenNotification = (notification: Notification) => {
    if (notification.is_read) return;

    setView((prev) => {
      const current = prev.items.find((item) => item.id === notification.id);

      if (!current || current.is_read) return prev;

      return {
        ...prev,
        items: onlyUnread
          ? prev.items.filter((item) => item.id !== notification.id)
          : prev.items.map((item) =>
              item.id === notification.id
                ? { ...item, is_read: true, read_at: new Date().toISOString() }
                : item
            ),
        total: onlyUnread ? Math.max(0, prev.total - 1) : prev.total,
        unread: Math.max(0, prev.unread - 1),
      };
    });

    void markAsRead(notification.id)
      .then(() => {
        invalidateNotificationCountCache();
      })
      .catch((markError) => {
        console.error('No se pudo marcar la notificación como leída al abrirla:', markError);
      });
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);

    try {
      const changed = await markAllAsRead();

      setView((prev) => ({
        items: onlyUnread
          ? []
          : prev.items.map((item) =>
              item.is_read ? item : { ...item, is_read: true, read_at: new Date().toISOString() }
            ),
        total: onlyUnread ? 0 : prev.total,
        allTotal: prev.allTotal,
        unread: 0,
      }));
      invalidateNotificationCountCache();

      if (changed > 0) {
        notifySuccess('Todo al día', 'Marcamos tus notificaciones como leídas.');
      } else {
        notifyInfo('No había nada pendiente', 'Todas tus notificaciones ya estaban leídas.');
      }
    } catch (markError) {
      notifyError(
        'No se pudieron marcar como leídas',
        errorMessage(markError, 'Inténtalo de nuevo en unos segundos.')
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (notification: Notification) => {
    const confirmed = await confirmDialog({
      title: '¿Eliminar esta notificación?',
      text: 'Se quitará de tu bandeja y no se puede deshacer.',
      confirmText: 'Eliminar',
      tone: 'danger',
    });

    if (!confirmed) return;

    setPendingId(notification.id);

    try {
      await deleteNotification(notification.id);

      setView((prev) => {
        const deleted = prev.items.find((item) => item.id === notification.id);

        // El evento de Realtime puede haberla quitado ya: no descontar dos veces.
        if (!deleted) return prev;

        return {
          items: prev.items.filter((item) => item.id !== notification.id),
          total: Math.max(0, prev.total - 1),
          allTotal: Math.max(0, prev.allTotal - 1),
          unread: deleted.is_read ? prev.unread : Math.max(0, prev.unread - 1),
        };
      });
      invalidateNotificationCountCache();
      notifySuccess('Notificación eliminada');
    } catch (deleteError) {
      notifyError(
        'No se pudo eliminar la notificación',
        errorMessage(deleteError, 'Inténtalo de nuevo en unos segundos.')
      );
    } finally {
      setPendingId(null);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'MATCH':
        return <Heart className="size-5 text-orange" />;
      case 'MESSAGE':
        return <MessageCircle className="size-5 text-turquoise" />;
      case 'REPORT':
        return <Flag className="size-5 text-lost" />;
      case 'PUBLICATION_UPDATE':
        return <AlertCircle className="size-5 text-purple" />;
      default:
        return <Bell className="size-5 text-foreground" />;
    }
  };

  if (authLoading) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10">
        <CatLoader size="lg" />
        <p className="font-display text-lg font-semibold text-foreground">
          Cargando notificaciones...
        </p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border-2 border-foreground/10 bg-surface p-8 text-center shadow-md">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-orange/10">
            <Bell className="size-8 text-orange" aria-hidden="true" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
            Tus avisos, en un solo lugar
          </h1>
          <p className="mx-auto mt-3 max-w-md text-foreground/70">
            Inicia sesión para ver las actualizaciones de tus publicaciones, las solicitudes de
            adopción y los mensajes que recibes.
          </p>
          <div className="mt-6 flex justify-center">
            <LinkButton href={`/auth/login?next=${encodeURIComponent('/notificaciones')}`}>
              Iniciar sesión
            </LinkButton>
          </div>
        </div>
      </section>
    );
  }

  if (error && !initialLoading) {
    return (
      <section className="py-10">
        <ErrorState
          title="No pudimos cargar tus notificaciones"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void loadPage(0, true)}>
              Reintentar
            </Button>
          }
        />
      </section>
    );
  }

  if (initialLoading) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10">
        <CatLoader size="lg" />
        <p className="font-display text-lg font-semibold text-foreground">
          Cargando notificaciones...
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6 py-8">
      {/* Cabecera */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange/10 via-app to-turquoise/10 border-2 border-foreground/10 p-8 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-24 bg-purple/20" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bell className="size-5 text-orange" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                Actualizaciones
              </span>
            </div>
            <h1 className="font-display text-4xl font-extrabold text-foreground">Notificaciones</h1>
            <p className="text-foreground/60 mt-1">
              {view.unread > 0
                ? `Tienes ${view.unread} notificación${view.unread !== 1 ? 'es' : ''} sin leer`
                : 'Estás al día'}
            </p>
          </div>
          {view.unread > 0 && (
            <Button
              variant="secondary"
              onClick={() => void handleMarkAllAsRead()}
              loading={markingAll}
              className="gap-2"
            >
              <CheckCheck className="size-5" />
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => changeFilter('all')}
          aria-pressed={filter === 'all'}
          className={[
            'px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-base',
            filter === 'all'
              ? 'bg-ink text-white shadow-md'
              : 'bg-surface text-foreground/70 border-2 border-foreground/10 hover:bg-foreground/5',
          ].join(' ')}
        >
          Todas ({view.allTotal})
        </button>
        <button
          type="button"
          onClick={() => changeFilter('unread')}
          aria-pressed={filter === 'unread'}
          className={[
            'px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-base',
            filter === 'unread'
              ? 'bg-ink text-white shadow-md'
              : 'bg-surface text-foreground/70 border-2 border-foreground/10 hover:bg-foreground/5',
          ].join(' ')}
        >
          Sin leer ({view.unread})
        </button>
      </div>

      {/* Lista */}
      {view.items.length === 0 ? (
        <EmptyState
          title={onlyUnread ? 'No tienes notificaciones sin leer' : 'No tienes notificaciones'}
          description={
            onlyUnread
              ? '¡Estás al día! Todas tus notificaciones han sido leídas.'
              : 'Cuando recibas notificaciones sobre tus publicaciones o coincidencias, aparecerán aquí.'
          }
          illustration="dog"
          action={
            onlyUnread && view.allTotal > 0 ? (
              <Button variant="secondary" onClick={() => changeFilter('all')}>
                Ver todas las notificaciones
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {view.items.map((notification) => {
            const safeLink = notification.link
              ? safeInternalPath(notification.link, '')
              : '';
            const isPending = pendingId === notification.id;

            return (
              <article
                key={notification.id}
                className={[
                  'group relative overflow-hidden rounded-2xl border-2 bg-surface p-5 shadow-sm transition-all hover:shadow-md',
                  notification.is_read ? 'border-foreground/10' : 'border-orange/30 bg-orange/5',
                ].join(' ')}
              >
                <div className="flex gap-4">
                  <div className="shrink-0">
                    <div className="size-12 rounded-xl bg-linear-to-br from-orange/20 to-turquoise/20 flex items-center justify-center">
                      {getIcon(notification.type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-display text-lg font-bold text-foreground">
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span className="shrink-0 size-2.5 rounded-full bg-orange shadow-paw animate-pulse" />
                      )}
                    </div>

                    <p className="text-foreground/70 leading-relaxed mb-3">{notification.body}</p>

                    <div className="flex flex-wrap items-center gap-3">
                      <time
                        dateTime={notification.created_at}
                        title={formatFullDate(notification.created_at)}
                        className="text-xs font-medium text-foreground/50"
                      >
                        {formatRelativeDate(notification.created_at)}
                      </time>

                      {safeLink && (
                        <Link
                          to={safeLink}
                          onClick={() => handleOpenNotification(notification)}
                          className="text-xs font-semibold text-orange hover:text-orange-dark transition-colors"
                        >
                          {notification.type === 'MESSAGE'
                            ? 'Abrir conversación →'
                            : 'Ver más →'}
                        </Link>
                      )}

                      <div className="ml-auto flex items-center gap-2">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            onClick={() => void handleMarkAsRead(notification.id)}
                            loading={isPending}
                            className="text-xs gap-1 h-8"
                            aria-label="Marcar como leída"
                          >
                            <Check className="size-3.5" />
                            Leída
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          onClick={() => void handleDelete(notification)}
                          disabled={isPending}
                          className="text-xs gap-1 h-8 text-lost/70 hover:text-lost"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {view.items.length < view.total && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={() => void loadPage(view.items.length, false)}
                loading={loadingMore}
              >
                Cargar más notificaciones
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default NotificationsPage;
