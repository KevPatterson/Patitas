import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, AlertCircle, Heart, MessageCircle, Flag } from 'lucide-react';
import { useAuth } from '../app/auth-context';
import { Button } from '../components/ui/button';
import { CatLoader } from '../components/ui/cat-loader';
import { EmptyState } from '../components/ui/empty-state';
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification, 
  getUnreadCount,
  subscribeToNotifications,
  type Notification 
} from '../lib/supabase/notifications';
import { setPageMeta } from '../lib/seo/page-meta';

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Dependencia estable: el objeto `user` cambia de identidad en cada refresco de
  // token de Supabase, y con él en las dependencias el efecto se re-ejecutaba sin
  // parar (el mismo problema que tenía el panel de adopciones).
  const userId = user?.id;

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const [data, count] = await Promise.all([
        getNotifications(),
        getUnreadCount(),
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setPageMeta({
      title: 'Notificaciones — Patitas',
      description: 'Revisa tus notificaciones y actualizaciones sobre tus publicaciones.',
      canonicalPath: '/notificaciones',
    });
  }, []);

  useEffect(() => {
    if (userId) {
      void loadNotifications();
    }
  }, [userId, loadNotifications]);

  /**
   * Tiempo real (tarea 5.6).
   *
   * La página cargaba una vez al entrar y no se enteraba de nada nuevo: había que
   * recargar a mano para ver una coincidencia o un comentario. Se suscribe a
   * `postgres_changes` filtrando por el propio `profile_id` (la RLS también lo
   * garantiza, pero el filtro evita tráfico innecesario).
   *
   * Si Realtime falla o no está disponible, el usuario sigue teniendo el botón de
   * recargar de la propia página: no se depende del canal para funcionar.
   */
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(user.id, (notification) => {
      setNotifications((prev) => {
        // Evita duplicar si el INSERT llega mientras se está recargando la lista.
        if (prev.some((item) => item.id === notification.id)) return prev;
        return [notification, ...prev];
      });

      if (!notification.is_read) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    return unsubscribe;
    // `userId` (cadena) en lugar de `user` (objeto): así el canal no se
    // resuscribe en cada refresco de token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      
      // Si era no leída, decrementar contador
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification && !notification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
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

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[60vh] gap-4 py-10">
        <CatLoader size="lg" />
        <p className="font-display text-lg font-semibold text-foreground">Cargando notificaciones...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 py-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange/10 via-app to-turquoise/10 border-2 border-foreground/10 p-8 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-24 bg-purple/20" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bell className="size-5 text-orange" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Actualizaciones</span>
            </div>
            <h1 className="font-display text-4xl font-extrabold text-foreground">Notificaciones</h1>
            <p className="text-foreground/60 mt-1">
              {unreadCount > 0 
                ? `Tienes ${unreadCount} notificación${unreadCount !== 1 ? 'es' : ''} sin leer`
                : 'Estás al día'
              }
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllAsRead} className="gap-2">
              <CheckCheck className="size-5" />
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFilter('all')}
          className={[
            'px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-base',
            filter === 'all'
              ? 'bg-ink text-white shadow-md'
              : 'bg-surface text-foreground/70 border-2 border-foreground/10 hover:bg-foreground/5',
          ].join(' ')}
        >
          Todas ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={[
            'px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-base',
            filter === 'unread'
              ? 'bg-ink text-white shadow-md'
              : 'bg-surface text-foreground/70 border-2 border-foreground/10 hover:bg-foreground/5',
          ].join(' ')}
        >
          Sin leer ({unreadCount})
        </button>
      </div>

      {/* Lista de notificaciones */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No tienes notificaciones sin leer' : 'No tienes notificaciones'}
          description={
            filter === 'unread'
              ? '¡Estás al día! Todas tus notificaciones han sido leídas.'
              : 'Cuando recibas notificaciones sobre tus publicaciones o coincidencias, aparecerán aquí.'
          }
          illustration="dog"
          action={
            filter === 'unread' && notifications.length > 0 ? (
              <Button variant="secondary" onClick={() => setFilter('all')}>
                Ver todas las notificaciones
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <article
              key={notification.id}
              className={[
                'group relative overflow-hidden rounded-2xl border-2 bg-surface p-5 shadow-sm transition-all hover:shadow-md',
                notification.is_read
                  ? 'border-foreground/10'
                  : 'border-orange/30 bg-orange/5',
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
                  
                  <p className="text-foreground/70 leading-relaxed mb-3">
                    {notification.body}
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <time className="text-xs font-medium text-foreground/50">
                      {new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(
                        Math.round((new Date(notification.created_at).getTime() - Date.now()) / 86400000),
                        'day'
                      )}
                    </time>

                    {notification.link && (
                      <Link 
                        to={notification.link}
                        className="text-xs font-semibold text-orange hover:text-orange-dark transition-colors"
                      >
                        {notification.type === 'MESSAGE' ? 'Abrir conversación →' : 'Ver publicación →'}
                      </Link>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-xs gap-1 h-8"
                          aria-label="Marcar como leída"
                        >
                          <Check className="size-3.5" />
                          Leída
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        onClick={() => handleDelete(notification.id)}
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
          ))}
        </div>
      )}
    </section>
  );
}

export default NotificationsPage;
