import { useEffect, useState } from 'react';
import { getUnreadCount } from '../supabase/notifications';
import { useAuth } from '../../app/auth-context';

// Cache compartido para evitar múltiples llamadas simultáneas
let cachedCount = 0;
let lastFetchTime = 0;
let fetchPromise: Promise<number> | null = null;

const CACHE_DURATION = 10_000; // 10 segundos de cache
const POLL_INTERVAL = 60_000; // Polling cada 60 segundos (reducido de 30)

/**
 * Hook para obtener el contador de notificaciones no leídas
 * Usa cache compartido entre componentes para evitar llamadas duplicadas
 */
export function useNotificationCount() {
  const { user, isLoading: authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(cachedCount);

  useEffect(() => {
    if (authLoading || !user) {
      setUnreadCount(0);
      return;
    }

    let active = true;

    const fetchCount = async () => {
      const now = Date.now();
      
      // Si hay un fetch en progreso, esperar a que termine
      if (fetchPromise) {
        try {
          const count = await fetchPromise;
          if (active) setUnreadCount(count);
        } catch {
          if (active) setUnreadCount(0);
        }
        return;
      }

      // Si el cache es reciente, usar el valor cacheado
      if (now - lastFetchTime < CACHE_DURATION) {
        if (active) setUnreadCount(cachedCount);
        return;
      }

      // Crear nueva petición
      fetchPromise = getUnreadCount({ includeMessages: false })
        .then((count) => {
          cachedCount = count;
          lastFetchTime = Date.now();
          return count;
        })
        .catch((error) => {
          console.error('Error fetching notification count:', error);
          return 0;
        })
        .finally(() => {
          fetchPromise = null;
        });

      try {
        const count = await fetchPromise;
        if (active) setUnreadCount(count);
      } catch {
        if (active) setUnreadCount(0);
      }
    };

    // Fetch inicial
    fetchCount();

    // Polling periódico
    const interval = setInterval(fetchCount, POLL_INTERVAL);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user, authLoading]);

  return unreadCount;
}

/**
 * Función para invalidar el cache manualmente
 * Útil después de marcar notificaciones como leídas
 */
export function invalidateNotificationCountCache() {
  lastFetchTime = 0;
  cachedCount = 0;
}
