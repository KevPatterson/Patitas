import { supabase } from './client';
import { ChatError } from '../utils/chat-error';

/**
 * Capa de datos del chat interno (migración 0019).
 *
 * El cliente NUNCA inserta conversaciones ni mensajes directamente: las RPC
 * son el único camino de escritura. La RLS solo permite leer a los dos
 * participantes. Si una operación falla, se lanza el error de Supabase para que
 * la UI muestre el mensaje que devuelve la base de datos.
 */

export type ConversationSummary = {
  conversation_id: string;
  publication_id: string | null;
  publication_title: string;
  publication_slug: string | null;
  publication_type: string;
  publication_status: string | null;
  publication_available: boolean;
  cover_storage_path: string | null;
  other_profile_id: string;
  other_username: string | null;
  other_avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  archived_at: string | null;
  contact_shared_at: string | null;
};

export type ConversationParticipant = {
  username: string;
  avatar_url: string | null;
};

export type ConversationPublication = {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  publication_images?: Array<{
    storage_path: string;
    is_cover: boolean;
    sort_order: number;
  }>;
};

export type ConversationDetail = {
  id: string;
  publication_id: string | null;
  owner_profile_id: string;
  requester_profile_id: string;
  publication_title: string;
  publication_slug: string | null;
  publication_type: string;
  archived_at: string | null;
  contact_shared_at: string | null;
  created_at: string;
  last_message_at: string;
  publication: ConversationPublication | null;
  owner: ConversationParticipant | null;
  requester: ConversationParticipant | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  has_external_link: boolean;
  has_phone: boolean;
  sender: {
    username: string;
    avatar_url: string | null;
  } | null;
};

export type SentMessage = {
  id: string;
  created_at: string;
  has_external_link: boolean;
  has_phone: boolean;
};

export type SharedContact = {
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
};

export type MessageReportReason =
  | 'SPAM'
  | 'SCAM'
  | 'HARASSMENT'
  | 'INAPPROPRIATE'
  | 'OTHER';

type RawConversationRow = {
  conversation_id: string;
  publication_id: string | null;
  publication_title: string;
  publication_slug: string | null;
  publication_type: string;
  publication_status: string | null;
  publication_available: boolean;
  cover_storage_path: string | null;
  other_profile_id: string;
  other_username: string | null;
  other_avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number | string;
  archived_at: string | null;
  contact_shared_at: string | null;
};

type RawMessageRow = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  has_external_link: boolean;
  has_phone: boolean;
  sender:
    | { username: string; avatar_url: string | null }
    | Array<{ username: string; avatar_url: string | null }>
    | null;
};

/**
 * Abre o reutiliza el hilo con el dueño de una publicación ACTIVE.
 *
 * Devuelve el id de la conversación. Si ya existía, no consume cuota ni crea
 * una fila nueva.
 */
export async function startConversation(publicationId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', {
    p_publication_id: publicationId,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

/**
 * Envía un mensaje con idempotencia.
 *
 * `clientMessageId` debe mantenerse igual al reintentar: si la primera llamada
 * llegó al servidor y la respuesta se perdió, la segunda devuelve el mismo
 * mensaje en vez de duplicarlo.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
  clientMessageId: string = crypto.randomUUID()
): Promise<SentMessage> {
  const { data, error } = await supabase.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: body.trim(),
    p_client_message_id: clientMessageId,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SentMessage[];
  const row = rows[0];

  if (!row) {
    throw new ChatError('No pudimos enviar tu mensaje.');
  }

  return row;
}

/**
 * Bandeja de entrada paginada. Ya viene ordenada por actividad reciente.
 */
export async function getConversations(limit = 50, offset = 0): Promise<ConversationSummary[]> {
  const { data, error } = await supabase.rpc('get_conversations', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RawConversationRow[]).map((row) => ({
    ...row,
    unread_count: Number(row.unread_count ?? 0),
  }));
}

type RawConversationDetail = Omit<
  ConversationDetail,
  'publication' | 'owner' | 'requester'
> & {
  publication: ConversationPublication | ConversationPublication[] | null;
  owner: ConversationParticipant | ConversationParticipant[] | null;
  requester: ConversationParticipant | ConversationParticipant[] | null;
};

/** PostgREST devuelve las relaciones como objeto o array según la cardinalidad. */
function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Se reexporta para que las pantallas tengan un único punto de importación.
 * La implementación vive en `utils/chat-error.ts` para poder probarla sin
 * cargar el cliente de Supabase.
 */
export { chatErrorMessage } from '../utils/chat-error';

/**
 * Cabecera del hilo: publicación (si sigue visible) y estado de archivo.
 */
export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `id,
       publication_id,
       owner_profile_id,
       requester_profile_id,
       publication_title,
       publication_slug,
       publication_type,
       archived_at,
       contact_shared_at,
       created_at,
       last_message_at,
       publication:publications(
         id,
         slug,
         title,
         type,
         status,
         publication_images(storage_path, is_cover, sort_order)
       ),
       owner:profiles!owner_profile_id(username, avatar_url),
       requester:profiles!requester_profile_id(username, avatar_url)`
    )
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ChatError('La conversación no existe o no participas en ella.');
  }

  const raw = data as unknown as RawConversationDetail;

  return {
    ...raw,
    publication: firstOrNull(raw.publication),
    owner: firstOrNull(raw.owner),
    requester: firstOrNull(raw.requester),
  };
}

/**
 * Mensajes del hilo, en orden cronológico ascendente.
 *
 * `before` es el `created_at` del mensaje más antiguo ya cargado: sirve para
 * paginar hacia atrás sin duplicados ni huecos.
 */
export async function getMessages(
  conversationId: string,
  options: { before?: string; limit?: number } = {}
): Promise<ChatMessage[]> {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);

  let query = supabase
    .from('messages')
    .select(
      `id,
       conversation_id,
       sender_profile_id,
       body,
       created_at,
       has_external_link,
       has_phone,
       sender:profiles!sender_profile_id(username, avatar_url)`
    )
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.before) {
    query = query.lt('created_at', options.before);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as RawMessageRow[])
    .map((row) => ({
      ...row,
      sender: Array.isArray(row.sender) ? row.sender[0] ?? null : row.sender,
    }))
    .reverse();
}

/**
 * Marca el hilo como leído y apaga la notificación MESSAGE asociada.
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }
}

/**
 * Total de mensajes sin leer. Es independiente del contador de notificaciones.
 */
export async function getUnreadChatCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_chat_count');

  if (error) {
    throw error;
  }

  return Number(data ?? 0);
}

/**
 * Escucha mensajes nuevos del hilo abierto.
 *
 * La RLS de SELECT decide qué llega por Realtime: no hace falta filtrar
 * participantes en el cliente. Devuelve la función para cerrar el canal.
 */
export function subscribeToConversation(
  conversationId: string,
  onMessage: (message: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as Omit<ChatMessage, 'sender'>;
        onMessage({ ...row, sender: null });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Escucha la bandeja completa.
 *
 * No lleva filtro por conversación: la RLS de SELECT limita los eventos a los
 * hilos del usuario, así que la bandeja puede refrescar su resumen sin conocer
 * de antemano qué conversaciones tiene.
 */
export function subscribeToInbox(onChange: () => void): () => void {
  const channel = supabase
    .channel('chat:inbox')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Límite que también aplica la restricción `messages_body_len` en la BD. */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export type ModerationContextMessage = {
  message_id: string;
  sender_profile_id: string;
  sender_username: string;
  body: string;
  created_at: string;
  has_external_link: boolean;
  has_phone: boolean;
  is_reported: boolean;
};

/**
 * Contexto de un mensaje reportado. Es el ÚNICO camino por el que moderación
 * puede leer un hilo: la RPC exige rol y registra la lectura en `audit_logs`.
 */
export async function getReportedContext(
  reportId: string,
  before = 20,
  after = 20
): Promise<ModerationContextMessage[]> {
  const { data, error } = await supabase.rpc('moderation_reported_context', {
    p_report_id: reportId,
    p_before: before,
    p_after: after,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ModerationContextMessage[];
}

export type MessageReportSummary = {
  id: string;
  message_id: string;
  conversation_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  reporter_username: string | null;
};

type RawMessageReportRow = Omit<MessageReportSummary, 'reporter_username'> & {
  reporter:
    | { username: string }
    | Array<{ username: string }>
    | null;
};

/** Reportes de mensajes visibles para moderación. */
export async function getMessageReports(limit = 50): Promise<MessageReportSummary[]> {
  const { data, error } = await supabase
    .from('message_reports')
    .select(
      `id,
       message_id,
       conversation_id,
       reason,
       details,
       status,
       created_at,
       resolved_at,
       reporter:profiles!reporter_profile_id(username)`
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as RawMessageReportRow[]).map((row) => {
    const reporter = Array.isArray(row.reporter) ? row.reporter[0] ?? null : row.reporter;

    return {
      id: row.id,
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      reason: row.reason,
      details: row.details,
      status: row.status,
      created_at: row.created_at,
      resolved_at: row.resolved_at,
      reporter_username: reporter?.username ?? null,
    };
  });
}

/**
 * Cierra un reporte. La RLS solo deja hacerlo a moderadores y el `with check`
 * exige que `resolved_by` sea quien lo cierra. Se deja rastro en auditoría.
 */
export async function resolveMessageReport(reportId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    throw new ChatError('Debes iniciar sesión para cerrar un reporte.');
  }

  const { error } = await supabase
    .from('message_reports')
    .update({
      status: 'RESOLVED',
      resolved_at: new Date().toISOString(),
      resolved_by: authData.user.id,
    })
    .eq('id', reportId);

  if (error) {
    throw error;
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    actor_profile_id: authData.user.id,
    action: 'CHAT_REPORT_RESOLVED',
    entity_type: 'message_report',
    entity_id: reportId,
    metadata: { via: 'admin_panel' },
  });

  if (auditError) {
    console.error('No se pudo registrar la auditoría del reporte:', auditError);
  }
}

/**
 * Reporta un mensaje concreto. El reporte habilita la revisión de moderación.
 */
export async function reportMessage(input: {
  messageId: string;
  conversationId: string;
  reason: MessageReportReason;
  details?: string;
}): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    throw new ChatError('Debes iniciar sesión para reportar un mensaje.');
  }

  const { error } = await supabase.from('message_reports').insert({
    message_id: input.messageId,
    conversation_id: input.conversationId,
    reporter_profile_id: authData.user.id,
    reason: input.reason,
    details: input.details?.trim() || null,
  });

  if (error) {
    throw error;
  }
}

/**
 * Bloquea a un usuario. El bloqueo corta el envío en ambos sentidos: lo aplica
 * la base de datos, no solo la UI.
 */
export async function blockProfile(profileId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    throw new ChatError('Debes iniciar sesión para bloquear a alguien.');
  }

  const { error } = await supabase.from('profile_blocks').insert({
    blocker_profile_id: authData.user.id,
    blocked_profile_id: profileId,
  });

  if (error) {
    throw error;
  }
}

/**
 * Quita el bloqueo. La RLS limita el DELETE a las filas propias.
 */
export async function unblockProfile(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('profile_blocks')
    .delete()
    .eq('blocked_profile_id', profileId);

  if (error) {
    throw error;
  }
}

export async function getBlockedProfileIds(): Promise<string[]> {
  const { data, error } = await supabase.from('profile_blocks').select('blocked_profile_id');

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ blocked_profile_id: string }>).map(
    (row) => row.blocked_profile_id
  );
}

/**
 * Comparte el contacto de la publicación dentro del hilo. Solo el dueño.
 */
export async function shareContact(conversationId: string): Promise<SharedContact | null> {
  const { data, error } = await supabase.rpc('share_publication_contact', {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SharedContact[])[0] ?? null;
}

/**
 * Lee el contacto que el dueño compartió. Queda auditado en el servidor.
 */
export async function getSharedContact(conversationId: string): Promise<SharedContact | null> {
  const { data, error } = await supabase.rpc('get_shared_contact', {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SharedContact[])[0] ?? null;
}
