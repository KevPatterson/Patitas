import { useEffect, useState } from 'react';
import { getUnreadCount } from '../supabase/notifications';
import { useAuth } from '../../app/auth-context';

/**
 * Contador de notificaciones sin leer para los badges de la cabecera.
 *
 * Mismo patrón que `useChatUnreadCount`: caché compartida entre componentes,
 * polling de respaldo y un evento para refrescar al instante cuando la página
 * de notificaciones marca o elimina algo (antes el badge podía tardar hasta
 * 60 segundos en reflejarlo).
 */

export const NOTIFICATION_UNREAD_EVENT = 'patitas:notification-unread';

let cachedCount = 0;
let cachedUserId: string | null = null;
let lastFetchTime = 0;
let fetchPromise: Promise<number> | null = null;
let fetchUserId: string | null = null;
let requestSeq = 0;

const CACHE_DURATION = 10_000;
const POLL_INTERVAL = 60_000;

export function useNotificationCount() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [unreadCount, setUnreadCount] = useState(() =>
    cachedUserId === userId ? cachedCount : 0
  );

  useEffect(() => {
    if (authLoading || !userId) {
      setUnreadCount(0);
      return;
    }

    let active = true;

    // La caché no puede cruzar sesiones: al cambiar de usuario se descarta.
    if (cachedUserId !== userId) {
      cachedUserId = userId;
      cachedCount = 0;
      lastFetchTime = 0;
    }

    const fetchCount = async (force = false) => {
      const now = Date.now();

      // Solo se reutiliza la petición en curso si es del mismo usuario. Con
      // `force` se ignora: tras una acción hay que leer el valor nuevo, no el
      // que ya estaba viajando.
      if (!force && fetchPromise && fetchUserId === userId) {
        const seq = requestSeq;
        try {
          const count = await fetchPromise;
          if (active && seq === requestSeq) setUnreadCount(count);
        } catch {
          if (active && seq === requestSeq) setUnreadCount(0);
        }
        return;
      }

      if (now - lastFetchTime < CACHE_DURATION) {
        if (active) setUnreadCount(cachedCount);
        return;
      }

      const seq = ++requestSeq;

      const request = getUnreadCount({ includeMessages: false })
        .then((count) => {
          // Si mientras tanto se cambió de sesión o se lanzó una petición más
          // reciente, este resultado ya no vale.
          if (cachedUserId === userId && seq === requestSeq) {
            cachedCount = count;
            lastFetchTime = Date.now();
          }
          return count;
        })
        .catch((error) => {
          console.error('Error al obtener las notificaciones sin leer:', error);
          return 0;
        })
        .finally(() => {
          if (fetchPromise === request) {
            fetchPromise = null;
            fetchUserId = null;
          }
        });

      fetchPromise = request;
      fetchUserId = userId;

      try {
        const count = await request;
        if (active && seq === requestSeq) setUnreadCount(count);
      } catch {
        if (active && seq === requestSeq) setUnreadCount(0);
      }
    };

    void fetchCount();

    const interval = setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL);

    // Tras marcar o eliminar desde la página se refresca al instante.
    const handleInvalidate = () => {
      lastFetchTime = 0;
      void fetchCount(true);
    };

    // Al volver a la pestaña se recupera el tiempo perdido sin esperar al polling.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastFetchTime = 0;
        void fetchCount(true);
      }
    };

    window.addEventListener(NOTIFICATION_UNREAD_EVENT, handleInvalidate);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener(NOTIFICATION_UNREAD_EVENT, handleInvalidate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, authLoading]);

  return unreadCount;
}

/**
 * Invalida la caché y avisa a los componentes montados. Se llama al marcar una
 * notificación como leída, marcar todas o eliminarla.
 */
export function invalidateNotificationCountCache() {
  lastFetchTime = 0;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATION_UNREAD_EVENT));
  }
}
