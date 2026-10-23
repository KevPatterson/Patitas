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

/**
 * Obtener todas las notificaciones del usuario autenticado
 */
export async function getNotifications(limit = 50): Promise<Notification[]> {
  try {
    const { data: userResponse, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userResponse.user) {
      console.warn('No hay usuario autenticado para obtener notificaciones');
      return [];
    }

    const user = userResponse.user;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error obteniendo notificaciones:', error);
      return [];
    }

    return (data as Notification[]) || [];
  } catch (err) {
    console.error('Error en getNotifications:', err);
    return [];
  }
}

/**
 * Obtener contador de notificaciones no leídas.
 *
 * `includeMessages: false` deja fuera los avisos de chat: la cabecera tiene un
 * badge propio para mensajes y, si se contaran en los dos, el mismo mensaje
 * aparecería duplicado.
 */
export async function getUnreadCount(
  options: { includeMessages?: boolean } = {}
): Promise<number> {
  try {
    const { data: userResponse, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userResponse.user) {
      console.warn('No hay usuario autenticado para obtener notificaciones');
      return 0;
    }

    const user = userResponse.user;

    let query = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', user.id)
      .eq('is_read', false);

    if (options.includeMessages === false) {
      query = query.neq('type', 'MESSAGE');
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error('Error en getUnreadCount:', err);
    return 0;
  }
}

/**
 * Marcar una notificación como leída
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) {
    throw error;
  }
}

/**
 * Marcar todas las notificaciones como leídas
 */
export async function markAllAsRead(): Promise<void> {
  try {
    const { data: userResponse, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userResponse.user) {
      console.warn('No hay usuario autenticado');
      return;
    }

    const user = userResponse.user;

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('profile_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marcando notificaciones como leídas:', error);
    }
  } catch (err) {
    console.error('Error en markAllAsRead:', err);
  }
}

/**
 * Eliminar una notificación
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    throw error;
  }
}

/**
 * Crear una notificación (solo para uso interno/server-side)
 */
export async function createNotification(input: {
  profileId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      profile_id: input.profileId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link || null,
      is_read: false,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

/**
 * Suscribirse a notificaciones en tiempo real
 */
export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: Notification) => void
) {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
