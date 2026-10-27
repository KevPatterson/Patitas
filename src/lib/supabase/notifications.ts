import { supabase } from './client';

export type NotificationType = 'MATCH' | 'REPORT' | 'MESSAGE' | 'PUBLICATION_UPDATE' | 'SYSTEM';

export type Notification = {
  id: string;
  profile_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

/** Tamaño de página por defecto de la bandeja de notificaciones. */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * Devuelve el id del usuario autenticado o lanza un error legible.
 *
 * Las funciones de esta capa ya no se tragan los errores: la página necesita
 * distinguir "no hay notificaciones" de "la consulta falló" para no mostrar un
 * estado vacío falso.
 */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error('No se pudo comprobar la sesión. Inténtalo de nuevo.');
  }

  if (!data.user) {
    throw new Error('Inicia sesión para gestionar tus notificaciones.');
  }

  return data.user.id;
}

export type GetNotificationsOptions = {
  limit?: number;
  offset?: number;
  onlyUnread?: boolean;
};

export type NotificationsPage = {
  items: Notification[];
  /** Total de filas que cumplen el filtro, no solo las de esta página. */
  total: number;
};

/**
 * Obtener una página de notificaciones del usuario autenticado.
 *
 * `total` sale del `count` exacto de PostgREST, que ignora el rango: sirve para
 * saber cuántas filas cumple el filtro activo y decidir si queda algo por
 * cargar (botón "Cargar más").
 */
export async function getNotifications({
  limit = NOTIFICATIONS_PAGE_SIZE,
  offset = 0,
  onlyUnread = false,
}: GetNotificationsOptions = {}): Promise<NotificationsPage> {
  const userId = await requireUserId();

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('profile_id', userId);

  if (onlyUnread) {
    query = query.eq('is_read', false);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error('No se pudieron cargar las notificaciones.');
  }

  return {
    items: (data as Notification[] | null) ?? [],
    total: count ?? 0,
  };
}

/**
 * Obtener contador de notificaciones no leídas.
 *
 * `includeMessages: false` deja fuera los avisos de chat: la cabecera tiene un
 * badge propio para mensajes y, si se contaran en los dos, el mismo mensaje
 * aparecería duplicado. La página de notificaciones sí los incluye porque su
 * lista también los muestra.
 */
export async function getUnreadCount(
  options: { includeMessages?: boolean } = {}
): Promise<number> {
  const userId = await requireUserId();

  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .eq('is_read', false);

  if (options.includeMessages === false) {
    query = query.neq('type', 'MESSAGE');
  }

  const { count, error } = await query;

  if (error) {
    throw new Error('No se pudo obtener el contador de notificaciones.');
  }

  return count ?? 0;
}

export type NotificationsOverview = {
  total: number;
  unread: number;
};

/**
 * Totales de la bandeja: todas las notificaciones y cuántas están sin leer.
 *
 * La página los necesita a la vez para las pestañas, porque el listado se pide
 * filtrado y su `total` solo representa el filtro activo.
 */
export async function getNotificationsOverview(): Promise<NotificationsOverview> {
  const userId = await requireUserId();

  const [totalResult, unreadResult] = await Promise.all([
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', userId),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .eq('is_read', false),
  ]);

  if (totalResult.error || unreadResult.error) {
    throw new Error('No se pudo obtener el resumen de notificaciones.');
  }

  return {
    total: totalResult.count ?? 0,
    unread: unreadResult.count ?? 0,
  };
}

/**
 * Marcar una notificación como leída.
 *
 * Devuelve `true` si realmente cambió alguna fila. El filtro `is_read = false`
 * evita sobrescribir `read_at` cuando ya estaba leída (por ejemplo, al pulsar
 * dos veces el enlace).
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('is_read', false)
    .select('id');

  if (error) {
    throw new Error('No se pudo marcar la notificación como leída.');
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Marcar todas las notificaciones del usuario como leídas.
 *
 * Solo toca las no leídas, así que el `read_at` original de las ya leídas se
 * conserva. Devuelve cuántas cambiaron.
 */
export async function markAllAsRead(): Promise<number> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('profile_id', userId)
    .eq('is_read', false)
    .select('id');

  if (error) {
    throw new Error('No se pudieron marcar las notificaciones como leídas.');
  }

  return data?.length ?? 0;
}

/**
 * Eliminar una notificación.
 *
 * Sin `.select()`, PostgREST no devuelve filas y una política RLS que filtre el
 * DELETE pasaría desapercibida: la UI creería que borró y la fila seguiría en
 * la tabla. Al pedir `id` podemos detectar el caso y avisar.
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .select('id');

  if (error) {
    throw new Error('No se pudo eliminar la notificación.');
  }

  if (!data || data.length === 0) {
    throw new Error('La notificación ya no existe o no tienes permiso para eliminarla.');
  }
}

export type NotificationRealtimeHandlers = {
  onInsert?: (notification: Notification) => void;
  onUpdate?: (notification: Notification) => void;
  onDelete?: (notification: Notification) => void;
};

/**
 * Suscribirse a los cambios de las notificaciones del usuario en tiempo real.
 *
 * El canal lleva el id del usuario en el nombre: con un nombre fijo
 * (`notifications`), dos sesiones o dos componentes reutilizaban el mismo canal
 * y Supabase descartaba la segunda suscripción.
 *
 * Los eventos DELETE necesitan REPLICA IDENTITY FULL (migración 0023) para que
 * `payload.old` incluya `profile_id`; sin eso el filtro no puede evaluarse.
 */
export function subscribeToNotifications(
  userId: string,
  handlers: NotificationRealtimeHandlers
): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${userId}`,
      },
      (payload) => {
        handlers.onInsert?.(payload.new as Notification);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${userId}`,
      },
      (payload) => {
        handlers.onUpdate?.(payload.new as Notification);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${userId}`,
      },
      (payload) => {
        handlers.onDelete?.(payload.old as Notification);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('Realtime de notificaciones no disponible; se usará el polling.');
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
