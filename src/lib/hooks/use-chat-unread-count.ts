import { useEffect, useState } from 'react';
import { getUnreadChatCount } from '../supabase/chat';
import { useAuth } from '../../app/auth-context';

/**
 * Contador de mensajes de chat sin leer para la cabecera.
 *
 * Va separado del contador de notificaciones a propósito: el usuario quiere
 * saber cuántas conversaciones lo esperan sin que se mezcle con avisos de
 * coincidencias o reportes. Se reutiliza el mismo patrón de caché que
 * `useNotificationCount` para no disparar una petición por cada render.
 */

export const CHAT_UNREAD_EVENT = 'patitas:chat-unread';

let cachedCount = 0;
let lastFetchTime = 0;
let fetchPromise: Promise<number> | null = null;

const CACHE_DURATION = 10_000;
const POLL_INTERVAL = 60_000;

export function useChatUnreadCount() {
  const { user, loading: authLoading } = useAuth();
  const [count, setCount] = useState(cachedCount);

  useEffect(() => {
    if (authLoading || !user) {
      setCount(0);
      return;
    }

    let active = true;

    const fetchCount = async () => {
      const now = Date.now();

      if (fetchPromise) {
        try {
          const value = await fetchPromise;
          if (active) setCount(value);
        } catch {
          if (active) setCount(0);
        }
        return;
      }

      if (now - lastFetchTime < CACHE_DURATION) {
        if (active) setCount(cachedCount);
        return;
      }

      fetchPromise = getUnreadChatCount()
        .then((value) => {
          cachedCount = value;
          lastFetchTime = Date.now();
          return value;
        })
        .catch((error) => {
          console.error('Error al obtener los mensajes sin leer:', error);
          return 0;
        })
        .finally(() => {
          fetchPromise = null;
        });

      try {
        const value = await fetchPromise;
        if (active) setCount(value);
      } catch {
        if (active) setCount(0);
      }
    };

    void fetchCount();

    const interval = setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL);

    // Tras enviar o leer un mensaje se invalida el caché y se refresca al
    // instante, sin esperar al polling.
    const handleInvalidate = () => {
      lastFetchTime = 0;
      void fetchCount();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastFetchTime = 0;
        void fetchCount();
      }
    };

    window.addEventListener(CHAT_UNREAD_EVENT, handleInvalidate);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener(CHAT_UNREAD_EVENT, handleInvalidate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, authLoading]);

  return count;
}

/**
 * Invalida el caché y avisa a los componentes suscritos. Se llama al enviar,
 * leer o recibir un mensaje.
 */
export function invalidateChatUnreadCache() {
  lastFetchTime = 0;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHAT_UNREAD_EVENT));
  }
}
