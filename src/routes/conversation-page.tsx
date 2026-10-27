import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  Flag,
  Link2,
  MessageCircle,
  Phone,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../app/auth-context';
import { Button, LinkButton } from '../components/ui/button';
import { CatLoader } from '../components/ui/cat-loader';
import { EmptyState, ErrorState } from '../components/ui/empty-state';
import { StatusBadge } from '../components/ui/status-badge';
import {
  blockProfile,
  chatErrorMessage,
  getBlockedProfileIds,
  getConversation,
  getMessages,
  getSharedContact,
  MAX_CHAT_MESSAGE_LENGTH,
  markConversationRead,
  reportMessage,
  sendMessage,
  shareContact,
  subscribeToConversation,
  unblockProfile,
  type ChatMessage,
  type ConversationDetail,
  type MessageReportReason,
  type SharedContact,
} from '../lib/supabase/chat';
import { supabase } from '../lib/supabase/client';
import { CHAT_REPORT_REASONS, getChatTypeHint, getSuggestedMessage } from '../lib/constants/chat-copy';
import { formatChatTime } from '../lib/utils/chat-format';
import { invalidateChatUnreadCache } from '../lib/hooks/use-chat-unread-count';
import { setPageMeta } from '../lib/seo/page-meta';

type PendingMessage = {
  clientId: string;
  body: string;
  createdAt: string;
  status: 'sending' | 'error';
  error: string | null;
};

type RenderableMessage = {
  key: string;
  body: string;
  createdAt: string;
  mine: boolean;
  hasExternalLink: boolean;
  hasPhone: boolean;
  username: string;
  avatarUrl: string | null;
  status: 'sent' | 'sending' | 'error';
  error: string | null;
  clientId: string | null;
};

function coverUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) {
    return null;
  }

  return supabase.storage.from('pet-images').getPublicUrl(storagePath).data.publicUrl;
}

function ContactDetails({ contact }: { contact: SharedContact }) {
  const phone = contact.contact_whatsapp ?? contact.contact_phone;
  const digits = phone?.replace(/[^0-9]/g, '') ?? '';

  return (
    <div className="space-y-2 rounded-2xl border-2 border-found/20 bg-found/5 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-found-dark">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Contacto compartido por el dueño
      </p>
      {phone ? (
        <a
          href={digits ? `https://wa.me/${digits}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-found-dark hover:underline"
        >
          <Phone className="size-4" aria-hidden="true" />
          {phone}
        </a>
      ) : null}
      {contact.contact_email ? (
        <a
          href={`mailto:${contact.contact_email}`}
          className="block text-sm font-semibold text-found-dark hover:underline"
        >
          {contact.contact_email}
        </a>
      ) : null}
    </div>
  );
}

export function ConversationPage() {
  const { conversationId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [draftTouched, setDraftTouched] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const [scamBannerVisible, setScamBannerVisible] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState<MessageReportReason>('SCAM');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const [sharedContact, setSharedContact] = useState<SharedContact | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const suggestionRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isOwner = conversation?.owner_profile_id === userId;

  const otherProfile = isOwner ? conversation?.requester : conversation?.owner;
  const otherId = isOwner ? conversation?.requester_profile_id : conversation?.owner_profile_id;
  const archived = Boolean(conversation?.archived_at);
  const publication = conversation?.publication ?? null;
  const publicationImages = publication?.publication_images ?? [];
  const coverImage =
    publicationImages.find((image) => image.is_cover) ?? publicationImages[0] ?? null;
  const cover = coverUrl(coverImage?.storage_path);

  const load = useCallback(async () => {
    if (!conversationId || !userId) return;

    setLoading(true);
    setLoadError(null);

    try {
      const detail = await getConversation(conversationId);
      const history = await getMessages(conversationId, { limit: 50 });

      setConversation(detail);
      setMessages(history);

      // Marcar como leído no debe impedir ver el hilo si falla.
      try {
        await markConversationRead(conversationId);
        invalidateChatUnreadCache();
      } catch {
        // El historial ya está cargado; el badge se actualizará en el próximo intento.
      }
    } catch (error) {
      setLoadError(chatErrorMessage(error, 'No pudimos abrir esta conversación.'));
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    setPageMeta({
      title: 'Conversación — Patitas',
      description: 'Chat privado sobre una publicación de mascotas.',
      canonicalPath: `/mensajes/${conversationId ?? ''}`,
      noindex: true,
    });
  }, [conversationId]);

  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      setLoading(false);
      return;
    }

    void load();
  }, [authLoading, userId, load]);

  // Mensajes en tiempo real. La RLS decide qué llega; si el canal falla, el
  // usuario puede recargar y el historial sigue intacto.
  useEffect(() => {
    if (!conversationId || !userId) return;

    const unsubscribe = subscribeToConversation(conversationId, (message) => {
      setMessages((previous) =>
        previous.some((item) => item.id === message.id) ? previous : [...previous, message]
      );

      if (message.sender_profile_id !== userId) {
        void markConversationRead(conversationId)
          .then(() => invalidateChatUnreadCache())
          .catch(() => undefined);
      }
    });

    return unsubscribe;
  }, [conversationId, userId]);

  // Estado del bloqueo propio hacia el otro participante.
  useEffect(() => {
    if (!otherId) return;

    let active = true;

    getBlockedProfileIds()
      .then((ids) => {
        if (active) setBlocked(ids.includes(otherId));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [otherId]);

  // Mensaje inicial sugerido, solo si el hilo está vacío y el usuario no ha
  // empezado a escribir. Es editable y nunca se envía solo.
  useEffect(() => {
    if (loading || !conversation || archived || isOwner) return;
    if (messages.length > 0 || pending.length > 0) return;
    if (suggestionRef.current === conversation.id) return;
    if (draftTouched || draft.trim().length > 0) return;

    setDraft(getSuggestedMessage(conversation.publication_type, conversation.publication_title));
    suggestionRef.current = conversation.id;
  }, [
    loading,
    conversation,
    archived,
    isOwner,
    messages.length,
    pending.length,
    draftTouched,
    draft,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, pending.length]);

  const renderableMessages = useMemo<RenderableMessage[]>(() => {
    if (!conversation) {
      return [];
    }

    const sent: RenderableMessage[] = messages.map((message) => {
      const fallbackProfile =
        message.sender_profile_id === conversation.owner_profile_id
          ? conversation.owner
          : conversation.requester;

      return {
        key: message.id,
        body: message.body,
        createdAt: message.created_at,
        mine: message.sender_profile_id === userId,
        hasExternalLink: message.has_external_link,
        hasPhone: message.has_phone,
        username: message.sender?.username ?? fallbackProfile?.username ?? 'Usuario',
        avatarUrl: message.sender?.avatar_url ?? fallbackProfile?.avatar_url ?? null,
        status: 'sent',
        error: null,
        clientId: null,
      };
    });

    const sending: RenderableMessage[] = pending.map((message) => ({
      key: message.clientId,
      body: message.body,
      createdAt: message.createdAt,
      mine: true,
      hasExternalLink: /(https?:\/\/|www\.)/i.test(message.body),
      hasPhone: message.body.replace(/[^0-9]/g, '').length >= 7,
      username: isOwner ? conversation.owner?.username ?? 'Tú' : conversation.requester?.username ?? 'Tú',
      avatarUrl: isOwner ? conversation.owner?.avatar_url ?? null : conversation.requester?.avatar_url ?? null,
      status: message.status,
      error: message.error,
      clientId: message.clientId,
    }));

    return [...sent, ...sending].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [conversation, messages, pending, userId, isOwner]);

  const send = async (retryClientId?: string) => {
    if (!conversation || !userId || archived || blocked) return;

    const retry = retryClientId
      ? pending.find((item) => item.clientId === retryClientId) ?? null
      : null;
    const body = (retry?.body ?? draft).trim();

    if (!body) {
      return;
    }

    if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
      setComposerError(`El mensaje no puede superar los ${MAX_CHAT_MESSAGE_LENGTH} caracteres.`);
      return;
    }

    const clientId = retry?.clientId ?? crypto.randomUUID();

    if (retry) {
      setPending((previous) =>
        previous.map((item) =>
          item.clientId === clientId ? { ...item, status: 'sending', error: null } : item
        )
      );
    } else {
      setPending((previous) => [
        ...previous,
        { clientId, body, createdAt: new Date().toISOString(), status: 'sending', error: null },
      ]);
      setDraft('');
      setDraftTouched(false);
    }

    setComposerError(null);

    try {
      const sent = await sendMessage(conversation.id, body, clientId);

      setPending((previous) => previous.filter((item) => item.clientId !== clientId));
      setMessages((previous) =>
        previous.some((item) => item.id === sent.id)
          ? previous
          : [
              ...previous,
              {
                id: sent.id,
                conversation_id: conversation.id,
                sender_profile_id: userId,
                body,
                created_at: sent.created_at,
                has_external_link: sent.has_external_link,
                has_phone: sent.has_phone,
                sender: isOwner ? conversation.owner : conversation.requester,
              },
            ]
      );
      invalidateChatUnreadCache();
    } catch (error) {
      setPending((previous) =>
        previous.map((item) =>
          item.clientId === clientId
            ? {
                ...item,
                status: 'error',
                error: chatErrorMessage(error, 'No pudimos enviar el mensaje. Reintenta.'),
              }
            : item
        )
      );
    }
  };

  const handleBlock = async () => {
    if (!otherId) return;

    setBlocking(true);
    setComposerError(null);

    try {
      await blockProfile(otherId);
      setBlocked(true);
      setBlockConfirm(false);
    } catch (error) {
      setComposerError(chatErrorMessage(error, 'No pudimos bloquear a este usuario.'));
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (!otherId) return;

    setBlocking(true);
    setComposerError(null);

    try {
      await unblockProfile(otherId);
      setBlocked(false);
    } catch (error) {
      setComposerError(chatErrorMessage(error, 'No pudimos quitar el bloqueo.'));
    } finally {
      setBlocking(false);
    }
  };

  const handleReport = async () => {
    if (!reportTarget || !conversation) return;

    setReportSubmitting(true);
    setReportFeedback(null);

    try {
      await reportMessage({
        messageId: reportTarget.id,
        conversationId: conversation.id,
        reason: reportReason,
        details: reportDetails,
      });
      setReportFeedback('Reporte enviado. El equipo de moderación podrá revisar esta conversación.');
      setReportDetails('');
    } catch (error) {
      setReportFeedback(chatErrorMessage(error, 'No pudimos enviar el reporte.'));
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleShareContact = async () => {
    if (!conversation) return;

    setContactLoading(true);
    setContactError(null);

    try {
      const contact = await shareContact(conversation.id);
      setSharedContact(contact);
      setConversation((previous) =>
        previous ? { ...previous, contact_shared_at: new Date().toISOString() } : previous
      );
    } catch (error) {
      setContactError(chatErrorMessage(error, 'No pudimos compartir tu contacto.'));
    } finally {
      setContactLoading(false);
    }
  };

  const handleViewContact = async () => {
    if (!conversation) return;

    setContactLoading(true);
    setContactError(null);

    try {
      const contact = await getSharedContact(conversation.id);
      setSharedContact(contact);
    } catch (error) {
      setContactError(chatErrorMessage(error, 'No pudimos obtener el contacto.'));
    } finally {
      setContactLoading(false);
    }
  };

  if (authLoading) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10">
        <CatLoader size="lg" />
        <p className="font-display text-lg font-semibold text-foreground">Cargando conversación...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border-2 border-foreground/10 bg-surface p-8 text-center shadow-md">
          <MessageCircle className="mx-auto mb-4 size-10 text-turquoise" aria-hidden="true" />
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Inicia sesión para ver esta conversación
          </h1>
          <p className="mt-2 text-foreground/70">Los mensajes son privados para sus participantes.</p>
          <div className="mt-6 flex justify-center">
            <LinkButton
              href={`/auth/login?next=${encodeURIComponent(`/mensajes/${conversationId ?? ''}`)}`}
            >
              Iniciar sesión
            </LinkButton>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10">
        <CatLoader size="lg" />
        <p className="font-display text-lg font-semibold text-foreground">Cargando conversación...</p>
      </section>
    );
  }

  if (loadError || !conversation) {
    return (
      <section className="py-10">
        <ErrorState
          title="No pudimos abrir la conversación"
          description={loadError ?? 'La conversación no existe o no participas en ella.'}
          action={
            <LinkButton href="/mensajes" variant="secondary">
              Volver a mensajes
            </LinkButton>
          }
        />
      </section>
    );
  }

  const canWrite = !archived && !blocked;
  const typeHint = getChatTypeHint(conversation.publication_type);

  return (
    <section className="py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {/* Cabecera del hilo */}
        <div className="flex items-center gap-3">
          <Link
            to="/mensajes"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-foreground/10 bg-surface text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label="Volver a mensajes"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-foreground bg-app/50">
              {otherProfile?.avatar_url ? (
                <img
                  src={otherProfile.avatar_url}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <UserRound className="size-5 text-foreground" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-foreground">
                @{otherProfile?.username ?? 'usuario'}
              </p>
              <p className="truncate text-xs font-medium text-foreground/50">
                {isOwner ? 'Interesado en tu publicación' : 'Dueño de la publicación'}
              </p>
            </div>
          </div>

          {blocked ? (
            <Button variant="ghost" size="sm" onClick={() => void handleUnblock()} loading={blocking}>
              Desbloquear
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBlockConfirm(true)}
              className="gap-1.5 text-lost/80 hover:text-lost"
              aria-label={`Bloquear a @${otherProfile?.username ?? 'este usuario'}`}
            >
              <Ban className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Bloquear</span>
            </Button>
          )}
        </div>

        {/* Tarjeta fija de la publicación */}
        <div className="sticky top-[84px] z-20">
          {publication ? (
            <Link
              to={`/p/${publication.slug}`}
              className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 bg-surface p-3 shadow-md transition-all hover:border-orange/30"
            >
              <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5">
                {cover ? (
                  <img src={cover} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center" aria-hidden="true">
                    <MessageCircle className="size-5 text-foreground/30" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{publication.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={publication.type} className="px-2 py-0.5 text-[10px]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                    {publication.status === 'ACTIVE' ? 'Activa' : publication.status === 'RESOLVED' ? 'Resuelta' : publication.status}
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 bg-surface p-3 shadow-md">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                <MessageCircle className="size-5 text-foreground/30" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {conversation.publication_title}
                </p>
                <p className="text-xs font-medium text-foreground/50">Publicación no disponible</p>
              </div>
              <StatusBadge status={conversation.publication_type} className="px-2 py-0.5 text-[10px]" />
            </div>
          )}
        </div>

        {/* Aviso anti-estafa */}
        {scamBannerVisible ? (
          <div className="flex items-start gap-3 rounded-2xl border-2 border-orange/30 bg-orange/10 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-orange-700" aria-hidden="true" />
            <div className="flex-1 text-sm text-foreground/80">
              <p className="font-bold text-foreground">Protege a tu mascota y a ti</p>
              <p className="mt-1">
                Nunca envíes dinero por adelantado ni compartas códigos de verificación. Si algo te
                parece raro, bloquea y reporta. Si reportas, el equipo de moderación podrá revisar
                esta conversación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScamBannerVisible(false)}
              className="rounded-lg p-1 text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label="Cerrar aviso de seguridad"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {/* Estado de archivo */}
        {archived ? (
          <div className="rounded-2xl border-2 border-orange/30 bg-orange/5 p-4">
            <p className="font-bold text-foreground">
              Esta publicación fue resuelta. La conversación está cerrada.
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              Puedes leer el historial, pero no enviar mensajes nuevos.
              {!publication ? ' La publicación ya no está disponible.' : ''}
            </p>
          </div>
        ) : null}

        {blocked ? (
          <div className="rounded-2xl border-2 border-lost/20 bg-lost/5 p-4">
            <p className="font-bold text-lost-dark">Has bloqueado a este usuario.</p>
            <p className="mt-1 text-sm text-foreground/70">
              No podrá enviarte mensajes mientras el bloqueo esté activo. Puedes desbloquearlo
              arriba.
            </p>
          </div>
        ) : null}

        {/* Hilo */}
        <div className="rounded-3xl border-2 border-foreground/10 bg-app/40 p-4">
          {renderableMessages.length === 0 ? (
            <EmptyState
              title="Todavía no hay mensajes"
              description={
                typeHint
                  ? `${typeHint} Tu primer mensaje puede romper el hielo.`
                  : 'Escribe el primer mensaje para empezar la conversación.'
              }
              illustration="dog"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {renderableMessages.map((message) => (
                <div
                  key={message.key}
                  className={['group flex gap-2', message.mine ? 'justify-end' : 'justify-start'].join(' ')}
                >
                  {!message.mine ? (
                    <div className="mt-auto flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/10 bg-surface">
                      {message.avatarUrl ? (
                        <img src={message.avatarUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <UserRound className="size-4 text-foreground/60" aria-hidden="true" />
                      )}
                    </div>
                  ) : null}

                  <div
                    className={[
                      'max-w-[85%] rounded-2xl border-2 px-4 py-2.5 shadow-sm sm:max-w-[75%]',
                      message.mine
                        ? 'rounded-br-md border-foreground/10 bg-orange-200 text-[var(--color-orange-900)]'
                        : 'rounded-bl-md border-foreground/10 bg-surface text-foreground',
                    ].join(' ')}
                  >
                    {!message.mine ? (
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-foreground/50">
                        @{message.username}
                      </p>
                    ) : null}

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.body}
                    </p>

                    {!message.mine && (message.hasPhone || message.hasExternalLink) ? (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-orange/10 px-2 py-1.5 text-[11px] font-medium text-orange-800">
                        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {message.hasPhone && message.hasExternalLink
                            ? 'Incluye un teléfono y un enlace.'
                            : message.hasPhone
                              ? 'Incluye un teléfono.'
                              : 'Incluye un enlace.'}{' '}
                          Ten cuidado antes de abrirlo.
                        </span>
                      </p>
                    ) : null}

                    <div
                      className={[
                        'mt-1 flex items-center gap-2 text-[10px] font-medium',
                        message.mine ? 'justify-end text-[var(--color-orange-900)]/70' : 'text-foreground/50',
                      ].join(' ')}
                    >
                      <time dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>

                      {message.mine ? (
                        message.status === 'sending' ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="size-3" aria-hidden="true" />
                            Enviando…
                          </span>
                        ) : message.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1">
                            <CheckCheck className="size-3" aria-hidden="true" />
                            Enviado
                          </span>
                        ) : (
                          <span className="font-bold text-lost-dark">No enviado</span>
                        )
                      ) : null}
                    </div>

                    {message.mine && message.status === 'error' ? (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-lost/10 px-2 py-1.5 text-[11px] text-lost-dark">
                        <span>{message.error ?? 'No se pudo enviar.'}</span>
                        <button
                          type="button"
                          onClick={() => void send(message.clientId ?? undefined)}
                          className="font-bold underline decoration-2 underline-offset-2"
                        >
                          Reintentar
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {!message.mine ? (
                    <button
                      type="button"
                      onClick={() => {
                        const original = messages.find((item) => item.id === message.key);
                        if (original) {
                          setReportTarget(original);
                          setReportFeedback(null);
                        }
                      }}
                      className="mt-auto rounded-lg p-1 text-foreground/30 opacity-60 transition-all hover:bg-lost/10 hover:text-lost group-hover:opacity-100"
                      aria-label={`Reportar mensaje de @${message.username}`}
                      title="Reportar mensaje"
                    >
                      <Flag className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Contacto compartido */}
        {conversation.contact_shared_at ? (
          sharedContact ? (
            <ContactDetails contact={sharedContact} />
          ) : (
            <div className="flex flex-col gap-2 rounded-2xl border-2 border-found/20 bg-found/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-found-dark">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  {isOwner ? 'Has compartido tu contacto' : 'El dueño compartió su contacto'}
                </p>
                <p className="mt-1 text-xs text-foreground/60">
                  {isOwner
                    ? 'El interesado puede verlo desde este hilo.'
                    : 'Puedes verlo y escribirle por WhatsApp si lo prefieres.'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void (isOwner ? handleShareContact() : handleViewContact())}
                loading={contactLoading}
                className="gap-1.5"
              >
                <Phone className="size-4" aria-hidden="true" />
                {isOwner ? 'Ver mis datos' : 'Ver contacto'}
              </Button>
            </div>
          )
        ) : isOwner && !archived ? (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-foreground/10 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">¿Prefieres hablar por WhatsApp?</p>
              <p className="mt-1 text-xs text-foreground/60">
                Comparte tu contacto sin escribirlo a mano. Queda registrado y el interesado lo ve
                aquí.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleShareContact()}
              loading={contactLoading}
              className="gap-1.5"
            >
              <Phone className="size-4" aria-hidden="true" />
              Compartir mi WhatsApp
            </Button>
          </div>
        ) : null}

        {contactError ? (
          <p className="rounded-2xl border border-lost/20 bg-lost/10 px-4 py-3 text-sm font-medium text-lost-dark">
            {contactError}
          </p>
        ) : null}

        {/* Compositor */}
        {canWrite ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="rounded-3xl border-2 border-foreground/10 bg-surface p-3 shadow-md"
          >
            <label htmlFor="chat-composer" className="sr-only">
              Escribe tu mensaje
            </label>
            <textarea
              id="chat-composer"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setDraftTouched(true);
                setComposerError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={MAX_CHAT_MESSAGE_LENGTH}
              placeholder="Escribe un mensaje claro y respetuoso…"
              className="w-full resize-none rounded-2xl border-2 border-foreground/10 bg-app/40 px-4 py-3 text-sm text-foreground outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium text-foreground/50">
                Enter para enviar · Shift + Enter para salto de línea
                {draft.length > 0 ? ` · ${draft.length}/${MAX_CHAT_MESSAGE_LENGTH}` : ''}
              </p>
              <Button
                type="submit"
                disabled={!draft.trim()}
                className="gap-2"
                aria-label="Enviar mensaje"
              >
                <Send className="size-4" aria-hidden="true" />
                Enviar
              </Button>
            </div>

            {composerError ? (
              <p className="mt-2 rounded-xl border border-lost/20 bg-lost/10 px-3 py-2 text-sm font-medium text-lost-dark">
                {composerError}
              </p>
            ) : null}
          </form>
        ) : archived ? (
          <div className="rounded-3xl border-2 border-foreground/10 bg-foreground/5 p-5 text-center">
            <p className="font-semibold text-foreground/70">
              La conversación está en solo lectura.
            </p>
          </div>
        ) : null}

        {typeHint && canWrite ? (
          <p className="flex items-start gap-2 rounded-2xl border border-turquoise/20 bg-turquoise/5 px-4 py-3 text-xs text-foreground/70">
            <Link2 className="mt-0.5 size-3.5 shrink-0 text-turquoise" aria-hidden="true" />
            {typeHint}
          </p>
        ) : null}
      </div>

      {/* Modal de bloqueo */}
      {blockConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-md rounded-3xl border-2 border-foreground/10 bg-surface p-6 shadow-2xl">
            <h2 className="font-display text-xl font-extrabold text-foreground">
              ¿Bloquear a @{otherProfile?.username ?? 'este usuario'}?
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              No podrá enviarte mensajes y tú no podrás escribirle mientras el bloqueo esté activo.
              El historial se conserva.
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setBlockConfirm(false)}
                disabled={blocking}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void handleBlock()}
                loading={blocking}
              >
                Bloquear
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de reporte */}
      {reportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-md rounded-3xl border-2 border-foreground/10 bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-extrabold text-foreground">
                  Reportar mensaje
                </h2>
                <p className="mt-1 text-xs text-foreground/60">
                  Si reportas un mensaje, el equipo de moderación podrá revisar esta conversación.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReportTarget(null);
                  setReportFeedback(null);
                }}
                className="rounded-lg p-1 text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
                aria-label="Cerrar reporte"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <blockquote className="mt-4 rounded-2xl border border-foreground/10 bg-app/40 px-4 py-3 text-sm text-foreground/70">
              “{reportTarget.body.slice(0, 240)}
              {reportTarget.body.length > 240 ? '…' : ''}”
            </blockquote>

            <label className="mt-4 block space-y-1.5 text-sm font-semibold text-foreground">
              <span>Motivo</span>
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value as MessageReportReason)}
                className="h-11 w-full rounded-2xl border-2 border-foreground/10 bg-surface px-3 text-foreground outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
              >
                {CHAT_REPORT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block space-y-1.5 text-sm font-semibold text-foreground">
              <span>Detalles (opcional)</span>
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Cuéntanos qué pasó."
                className="w-full resize-none rounded-2xl border-2 border-foreground/10 bg-app/40 px-3 py-2 text-sm text-foreground outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
              />
            </label>

            {reportFeedback ? (
              <p
                className={[
                  'mt-3 rounded-2xl px-4 py-3 text-sm font-medium',
                  reportFeedback.startsWith('Reporte enviado')
                    ? 'border border-found/20 bg-found/10 text-found-dark'
                    : 'border border-lost/20 bg-lost/10 text-lost-dark',
                ].join(' ')}
              >
                {reportFeedback}
              </p>
            ) : null}

            <div className="mt-4 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setReportTarget(null);
                  setReportFeedback(null);
                }}
                disabled={reportSubmitting}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void handleReport()}
                loading={reportSubmitting}
                disabled={Boolean(reportFeedback?.startsWith('Reporte enviado'))}
              >
                Enviar reporte
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ConversationPage;
