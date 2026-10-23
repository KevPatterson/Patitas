-- ════════════════════════════════════════════════════════════════════════════
-- Migración 0019 — Chat interno anclado a publicaciones
-- ════════════════════════════════════════════════════════════════════════════
--
-- Chat privado 1:1 entre el dueño de una publicación y el usuario interesado.
-- No sustituye a `comments` (público) ni a `adoption_requests` (solicitud con
-- estado): es el canal directo para "vi a tu perro" o "quiero adoptarlo".
--
-- Decisiones de producto que esta migración hace cumplir en la BD:
--
--   1. Sirve para TODOS los tipos de publicación (LOST, FOUND, ABANDONED,
--      ADOPTION, SIGHTING). El copy del botón lo decide la UI; la regla no
--      cambia.
--   2. Cuando la publicación se resuelve, se oculta o se elimina, la
--      conversación queda ARCHIVADA EN SOLO LECTURA. No se borra: el historial
--      es evidencia ante disputas o intentos de estafa. Un trigger reactiva el
--      hilo si la publicación vuelve a ACTIVE.
--   3. El chat interno es la puerta de entrada, pero el dueño puede compartir
--      su contacto explícitamente (`share_publication_contact`). Esa acción
--      queda auditada y el destinatario puede leerlo sin consumir la cuota de
--      `reveal_publication_contact`, porque hay consentimiento del dueño.
--   4. Solo MODERATOR/ADMIN pueden leer una conversación reportada, únicamente
--      a través de `moderation_reported_context`, que devuelve el contexto
--      alrededor del mensaje (±20 por defecto, máximo ±50) y registra la
--      lectura en `audit_logs`.
--
-- Otras reglas:
--   - El cliente NO inserta conversaciones ni mensajes directamente: solo
--     puede llamar a las RPC. La RLS deja lectura a los participantes y nada
--     más.
--   - `profile_blocks` corta el envío en la BD, en ambos sentidos.
--   - Mensajes idempotentes con `client_message_id`: reintentar por mala
--     conexión no duplica.
--   - Señales anti-estafa: se marcan enlaces y teléfonos (`has_external_link`,
--     `has_phone`) para avisar al receptor, sin bloquear el mensaje.
--   - Retención: `purge_archived_conversations` borra hilos archivados tras
--     90 días. Solo service_role; se espera un cron.
--
-- Idempotente.
--
-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────────────
--   alter publication supabase_realtime drop table public.messages;
--   drop trigger if exists publications_archive_chats_delete on public.publications;
--   drop trigger if exists publications_archive_chats on public.publications;
--   drop trigger if exists messages_after_insert on public.messages;
--   drop trigger if exists messages_rate_limit on public.messages;
--   drop trigger if exists messages_validate on public.messages;
--   drop trigger if exists message_reports_rate_limit on public.message_reports;
--   drop function if exists public.purge_archived_conversations(integer);
--   drop function if exists public.moderation_reported_context(uuid, integer, integer);
--   drop function if exists public.get_shared_contact(uuid);
--   drop function if exists public.share_publication_contact(uuid);
--   drop function if exists public.unread_chat_count();
--   drop function if exists public.get_conversations(integer, integer);
--   drop function if exists public.mark_conversation_read(uuid);
--   drop function if exists public.notify_chat_message();
--   drop function if exists public.validate_chat_message();
--   drop function if exists public.archive_chats_on_publication_delete();
--   drop function if exists public.sync_chat_archive();
--   drop function if exists public.send_message(uuid, text, uuid);
--   drop function if exists public.start_conversation(uuid);
--   drop table if exists public.message_reports;
--   drop table if exists public.profile_blocks;
--   drop table if exists public.conversation_reads;
--   drop table if exists public.messages;
--   drop table if exists public.conversations;
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Tablas
-- ════════════════════════════════════════════════════════════════════════════

/*
 * Guardamos una copia del título, slug y tipo de la publicación en el propio
 * hilo. Si mañana se borra de verdad la publicación (hard delete), el chat
 * sigue existiendo y la UI puede mostrar "Publicación no disponible" sin
 * quedarse sin contexto.
 */
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.publications(id) on delete set null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  publication_title text not null,
  publication_slug text,
  publication_type public.publication_type not null,
  archived_at timestamptz,
  contact_shared_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_distinct_people check (owner_profile_id <> requester_profile_id)
);

-- Un solo hilo por publicación e interesado. Parcial porque `publication_id`
-- puede quedar NULL tras un hard delete y ahí ya no hay nada que deduplicar.
create unique index if not exists conversations_unique_pair_idx
  on public.conversations (publication_id, requester_profile_id)
  where publication_id is not null;

create index if not exists conversations_owner_idx
  on public.conversations (owner_profile_id, last_message_at desc);

create index if not exists conversations_requester_idx
  on public.conversations (requester_profile_id, last_message_at desc);

create index if not exists conversations_publication_idx
  on public.conversations (publication_id, last_message_at desc);

comment on table public.conversations is
  'Hilo privado 1:1 dueño/publicación-interesado. Se archiva en solo lectura cuando la publicación deja de estar activa.';
comment on column public.conversations.contact_shared_at is
  'Momento en que el dueño compartió su contacto dentro del hilo. NULL = no lo ha compartido.';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  client_message_id uuid not null,
  has_external_link boolean not null default false,
  has_phone boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint messages_body_len check (char_length(btrim(body)) between 1 and 2000),
  constraint messages_client_unique unique (conversation_id, client_message_id)
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);

comment on table public.messages is
  'Mensajes del chat. Inmutables para el cliente: solo se insertan por send_message() y se leen por RLS.';
comment on column public.messages.client_message_id is
  'UUID generado en el navegador. Hace idempotente el reenvío tras un corte de conexión.';
comment on column public.messages.has_external_link is
  'Marca para avisar al receptor de que el mensaje contiene un enlace. No bloquea el envío.';
comment on column public.messages.has_phone is
  'Marca para avisar al receptor de que el mensaje contiene un posible teléfono. No bloquea el envío.';

/*
 * Última lectura por participante. Con esto se calcula el contador de no
 * leídos sin añadir una columna por usuario a `conversations`.
 */
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default 'epoch',
  primary key (conversation_id, profile_id)
);

comment on table public.conversation_reads is
  'Última lectura de cada participante en cada hilo. Base del contador de no leídos.';

create table if not exists public.profile_blocks (
  blocker_profile_id uuid not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_profile_id, blocked_profile_id),
  constraint profile_blocks_not_self check (blocker_profile_id <> blocked_profile_id)
);

comment on table public.profile_blocks is
  'Bloqueos entre usuarios. Cortan el envío de mensajes en ambos sentidos, no solo en la UI.';

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  constraint message_reports_reason_valid
    check (reason in ('SPAM', 'SCAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER')),
  constraint message_reports_status_valid
    check (status in ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
  constraint message_reports_details_len
    check (details is null or char_length(details) <= 1000)
);

create index if not exists message_reports_status_idx
  on public.message_reports (status, created_at desc);

create index if not exists message_reports_conversation_idx
  on public.message_reports (conversation_id, created_at desc);

comment on table public.message_reports is
  'Reportes de mensajes concretos. El contenido solo se consulta con moderation_reported_context(), que audita la lectura.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. RLS y privilegios de tabla
-- ════════════════════════════════════════════════════════════════════════════

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.message_reports enable row level security;

revoke all on public.conversations from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.conversation_reads from anon, authenticated;
revoke all on public.profile_blocks from anon, authenticated;
revoke all on public.message_reports from anon, authenticated;

grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant select on public.conversation_reads to authenticated;

-- Bloqueos y reportes se escriben desde el cliente, pero la RLS limita siempre
-- a las filas propias. Conversaciones, mensajes y lecturas solo se escriben por
-- RPC o triggers.
grant select, insert, delete on public.profile_blocks to authenticated;
grant select, insert on public.message_reports to authenticated;

-- Un moderador cierra el reporte, pero no puede reescribir el mensaje reportado,
-- el motivo ni el denunciante: solo estas tres columnas.
grant update (status, resolved_at, resolved_by) on public.message_reports to authenticated;

-- ── Conversaciones ─────────────────────────────────────────────────────────
-- Sin política de INSERT/UPDATE/DELETE: se crean por RPC y el estado solo lo
-- cambian triggers SECURITY DEFINER.

drop policy if exists "participants can read conversations" on public.conversations;
create policy "participants can read conversations"
  on public.conversations
  for select
  to authenticated
  using (
    owner_profile_id = auth.uid()
    or requester_profile_id = auth.uid()
  );

-- ── Mensajes ───────────────────────────────────────────────────────────────
-- Solo lectura para los participantes. La inserción va por send_message().

drop policy if exists "participants can read messages" on public.messages;
create policy "participants can read messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.conversations c
       where c.id = messages.conversation_id
         and (c.owner_profile_id = auth.uid() or c.requester_profile_id = auth.uid())
    )
  );

-- ── Lecturas ───────────────────────────────────────────────────────────────

drop policy if exists "participants can read own read markers" on public.conversation_reads;
create policy "participants can read own read markers"
  on public.conversation_reads
  for select
  to authenticated
  using (profile_id = auth.uid());

-- ── Bloqueos ───────────────────────────────────────────────────────────────

drop policy if exists "users can read own blocks" on public.profile_blocks;
create policy "users can read own blocks"
  on public.profile_blocks
  for select
  to authenticated
  using (blocker_profile_id = auth.uid());

drop policy if exists "users can create own blocks" on public.profile_blocks;
create policy "users can create own blocks"
  on public.profile_blocks
  for insert
  to authenticated
  with check (blocker_profile_id = auth.uid());

drop policy if exists "users can remove own blocks" on public.profile_blocks;
create policy "users can remove own blocks"
  on public.profile_blocks
  for delete
  to authenticated
  using (blocker_profile_id = auth.uid());

-- ── Reportes de mensajes ───────────────────────────────────────────────────

drop policy if exists "participants can report messages" on public.message_reports;
create policy "participants can report messages"
  on public.message_reports
  for insert
  to authenticated
  with check (
    reporter_profile_id = auth.uid()
    -- El denunciante no puede crear un reporte ya cerrado ni atribuir el
    -- cierre a otra persona: el estado inicial siempre es PENDING.
    and status = 'PENDING'
    and resolved_at is null
    and resolved_by is null
    and exists (
      select 1
        from public.messages m
        join public.conversations c on c.id = m.conversation_id
       where m.id = message_reports.message_id
         and m.conversation_id = message_reports.conversation_id
         and (c.owner_profile_id = auth.uid() or c.requester_profile_id = auth.uid())
    )
  );

drop policy if exists "reporters and moderators can read message reports" on public.message_reports;
create policy "reporters and moderators can read message reports"
  on public.message_reports
  for select
  to authenticated
  using (
    reporter_profile_id = auth.uid()
    or exists (
      select 1 from public.profiles pr
       where pr.id = auth.uid() and pr.role in ('MODERATOR', 'ADMIN')
    )
  );

drop policy if exists "moderators can manage message reports" on public.message_reports;
create policy "moderators can manage message reports"
  on public.message_reports
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
       where pr.id = auth.uid() and pr.role in ('MODERATOR', 'ADMIN')
    )
  )
  with check (
    exists (
      select 1 from public.profiles pr
       where pr.id = auth.uid() and pr.role in ('MODERATOR', 'ADMIN')
    )
    and (resolved_by is null or resolved_by = auth.uid())
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Abrir conversación
-- ════════════════════════════════════════════════════════════════════════════
--
-- El dueño se deriva de la publicación, nunca lo envía el cliente. Así no se
-- puede fabricar un hilo con participantes falsos.

create or replace function public.start_conversation(p_publication_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_pub record;
  v_id uuid;
  v_allowed boolean;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = '42501',
            hint = 'Inicia sesión para escribir al dueño.';
  end if;

  select p.id, p.owner_profile_id, p.title, p.slug, p.type, p.status, p.deleted_at
    into v_pub
    from public.publications p
   where p.id = p_publication_id;

  if not found or v_pub.deleted_at is not null then
    raise exception 'publication not available'
      using errcode = '42501',
            hint = 'La publicación no está disponible.';
  end if;

  -- Publicaciones importadas sin dueño identificable: no hay a quién escribir.
  if v_pub.owner_profile_id is null then
    raise exception 'publication has no owner'
      using errcode = '42501',
            detail = jsonb_build_object(
              'code', 'CHAT_NO_OWNER',
              'message', 'Esta publicación no permite mensajes directos.'
            )::text,
            hint = 'Esta publicación no permite mensajes directos.';
  end if;

  if v_pub.owner_profile_id = v_actor then
    raise exception 'cannot message own publication'
      using errcode = '23514',
            detail = jsonb_build_object(
              'code', 'CHAT_OWN_PUBLICATION',
              'message', 'No puedes escribirte a ti mismo.'
            )::text,
            hint = 'No puedes escribirte a ti mismo.';
  end if;

  -- Reutilizar el hilo existente es la vía normal: el botón cambia a
  -- "Continuar conversación". Se devuelve aunque la publicación ya esté
  -- resuelta, porque el hilo archivado debe poder abrirse en solo lectura.
  select c.id into v_id
    from public.conversations c
   where c.publication_id = p_publication_id
     and c.requester_profile_id = v_actor;

  if v_id is not null then
    return v_id;
  end if;

  -- A partir de aquí solo se crean hilos nuevos.
  if v_pub.status <> 'ACTIVE' then
    raise exception 'publication closed'
      using errcode = '42501',
            detail = jsonb_build_object(
              'code', 'CHAT_PUBLICATION_CLOSED',
              'message', 'Esta publicación ya está cerrada. No se pueden iniciar conversaciones nuevas.'
            )::text,
            hint = 'Esta publicación ya está cerrada.';
  end if;

  if exists (
    select 1
      from public.profile_blocks b
     where (b.blocker_profile_id = v_actor and b.blocked_profile_id = v_pub.owner_profile_id)
        or (b.blocker_profile_id = v_pub.owner_profile_id and b.blocked_profile_id = v_actor)
  ) then
    raise exception 'chat blocked'
      using errcode = '42501',
            detail = jsonb_build_object(
              'code', 'CHAT_BLOCKED',
              'message', 'No puedes iniciar una conversación con este usuario.'
            )::text,
            hint = 'No puedes iniciar una conversación con este usuario.';
  end if;

  v_allowed := public.rate_limit_hit(v_actor, 'start_conversation', 20, 86400);

  if not v_allowed then
    raise exception 'conversation limit exceeded'
      using errcode = '53400',
            detail = jsonb_build_object(
              'code', 'CHAT_START_LIMIT',
              'message', 'Has iniciado demasiadas conversaciones hoy. Vuelve mañana.',
              'limit', 20,
              'window', '24 horas'
            )::text,
            hint = 'Has iniciado demasiadas conversaciones hoy.';
  end if;

  insert into public.conversations (
    publication_id,
    owner_profile_id,
    requester_profile_id,
    publication_title,
    publication_slug,
    publication_type
  )
  values (
    v_pub.id,
    v_pub.owner_profile_id,
    v_actor,
    v_pub.title,
    v_pub.slug,
    v_pub.type
  )
  on conflict do nothing
  returning id into v_id;

  -- Carrera con otra pestaña: el índice único parcial decide y aquí se recoge.
  if v_id is null then
    select c.id into v_id
      from public.conversations c
     where c.publication_id = p_publication_id
       and c.requester_profile_id = v_actor;
  end if;

  if v_id is null then
    raise exception 'conversation could not be created'
      using errcode = '40001',
            hint = 'No pudimos abrir la conversación. Inténtalo de nuevo.';
  end if;

  insert into public.conversation_reads (conversation_id, profile_id)
  values (v_id, v_pub.owner_profile_id), (v_id, v_actor)
  on conflict do nothing;

  return v_id;
end;
$fn$;

comment on function public.start_conversation(uuid) is
  'Crea o reutiliza el hilo del usuario con el dueño de una publicación ACTIVE. Deriva el dueño en el servidor.';

revoke all on function public.start_conversation(uuid) from public, anon, authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Validación de mensajes
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.validate_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_conv record;
begin
  select c.owner_profile_id, c.requester_profile_id, c.archived_at
    into v_conv
    from public.conversations c
   where c.id = new.conversation_id;

  if not found then
    raise exception 'conversation not found'
      using errcode = '23503',
            hint = 'La conversación no existe.';
  end if;

  if new.sender_profile_id not in (v_conv.owner_profile_id, v_conv.requester_profile_id) then
    raise exception 'not a conversation participant'
      using errcode = '42501',
            detail = jsonb_build_object(
              'code', 'CHAT_NOT_PARTICIPANT',
              'message', 'No participas en esta conversación.'
            )::text,
            hint = 'No participas en esta conversación.';
  end if;

  if v_conv.archived_at is not null then
    raise exception 'conversation archived'
      using errcode = '23514',
            detail = jsonb_build_object(
              'code', 'CHAT_ARCHIVED',
              'message', 'Esta publicación fue resuelta. La conversación está cerrada.'
            )::text,
            hint = 'Esta conversación está cerrada.';
  end if;

  if exists (
    select 1
      from public.profile_blocks b
     where (b.blocker_profile_id = v_conv.owner_profile_id and b.blocked_profile_id = v_conv.requester_profile_id)
        or (b.blocker_profile_id = v_conv.requester_profile_id and b.blocked_profile_id = v_conv.owner_profile_id)
  ) then
    raise exception 'chat blocked'
      using errcode = '42501',
            detail = jsonb_build_object(
              'code', 'CHAT_BLOCKED',
              'message', 'No puedes enviar mensajes a este usuario.'
            )::text,
            hint = 'No puedes enviar mensajes a este usuario.';
  end if;

  new.body := btrim(new.body);

  if char_length(new.body) < 1 then
    raise exception 'empty chat message'
      using errcode = '23514',
            detail = jsonb_build_object(
              'code', 'CHAT_EMPTY_MESSAGE',
              'message', 'El mensaje no puede estar vacío.'
            )::text,
            hint = 'El mensaje no puede estar vacío.';
  end if;

  -- Se comprueba aquí para devolver un mensaje en español en vez de dejar que
  -- salte la restricción `messages_body_len` con el texto técnico de Postgres.
  if char_length(new.body) > 2000 then
    raise exception 'chat message too long'
      using errcode = '23514',
            detail = jsonb_build_object(
              'code', 'CHAT_MESSAGE_TOO_LONG',
              'message', 'El mensaje no puede superar los 2000 caracteres.'
            )::text,
            hint = 'El mensaje no puede superar los 2000 caracteres.';
  end if;

  -- Señales para la UI, no bloqueos. Un teléfono legítimo debe poder enviarse;
  -- el receptor solo recibe un aviso discreto.
  new.has_external_link := new.body ~* '(https?://|www\.)';
  new.has_phone := length(regexp_replace(new.body, '[^0-9]', '', 'g')) >= 7;

  return new;
end;
$fn$;

comment on function public.validate_chat_message() is
  'Valida participante, archivo y bloqueo; normaliza el cuerpo y marca enlaces/teléfonos sin bloquear.';

revoke all on function public.validate_chat_message() from public, anon, authenticated;

drop trigger if exists messages_validate on public.messages;
create trigger messages_validate
  before insert on public.messages
  for each row
  execute function public.validate_chat_message();

-- Cuota de mensajes: 60/hora (20/hora si la cuenta tiene menos de 24 h).
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row
  execute function public.tg_rate_limit('message', 'sender_profile_id', 'hour', '60', '20');

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Envío idempotente
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text,
  p_client_message_id uuid
)
returns table(
  id uuid,
  created_at timestamptz,
  has_external_link boolean,
  has_phone boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_row public.messages%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = '42501',
            hint = 'Inicia sesión para enviar mensajes.';
  end if;

  if p_client_message_id is null then
    raise exception 'client message id required'
      using errcode = '23514',
            detail = jsonb_build_object(
              'code', 'CHAT_CLIENT_ID_REQUIRED',
              'message', 'Falta el identificador del mensaje.'
            )::text,
            hint = 'Falta el identificador del mensaje.';
  end if;

  if p_body is null or char_length(btrim(p_body)) < 1 then
    raise exception 'empty chat message'
      using errcode = '23514',
            detail = jsonb_build_object(
              'code', 'CHAT_EMPTY_MESSAGE',
              'message', 'El mensaje no puede estar vacío.'
            )::text,
            hint = 'El mensaje no puede estar vacío.';
  end if;

  if char_length(btrim(p_body)) > 2000 then
    raise exception 'chat message too long'
      using errcode = '23514',
            detail = jsonb_build_object(
              'code', 'CHAT_MESSAGE_TOO_LONG',
              'message', 'El mensaje no puede superar los 2000 caracteres.'
            )::text,
            hint = 'El mensaje no puede superar los 2000 caracteres.';
  end if;

  -- Reintento tras un corte: devolver el mismo mensaje en vez de duplicarlo.
  select m.* into v_row
    from public.messages m
   where m.conversation_id = p_conversation_id
     and m.client_message_id = p_client_message_id
     and m.sender_profile_id = v_actor;

  if found then
    return query
      select v_row.id, v_row.created_at, v_row.has_external_link, v_row.has_phone;
    return;
  end if;

  -- El trigger BEFORE valida participante, archivo y bloqueo, y aplica la
  -- cuota. Aquí solo se inserta. Si dos pestañas envían el mismo
  -- client_message_id a la vez, la segunda recoge el mensaje ya insertado.
  begin
    insert into public.messages (conversation_id, sender_profile_id, body, client_message_id)
    values (p_conversation_id, v_actor, p_body, p_client_message_id)
    returning * into v_row;
  exception when unique_violation then
    select m.* into v_row
      from public.messages m
     where m.conversation_id = p_conversation_id
       and m.client_message_id = p_client_message_id
       and m.sender_profile_id = v_actor;
  end;

  if v_row.id is null then
    raise exception 'client message id conflict'
      using errcode = '23505',
            detail = jsonb_build_object(
              'code', 'CHAT_CLIENT_ID_CONFLICT',
              'message', 'Ese identificador de mensaje ya está en uso.'
            )::text,
            hint = 'Ese identificador de mensaje ya está en uso.';
  end if;

  return query
    select v_row.id, v_row.created_at, v_row.has_external_link, v_row.has_phone;
end;
$fn$;

comment on function public.send_message(uuid, text, uuid) is
  'Inserta un mensaje de forma idempotente (client_message_id) y devuelve sus marcas anti-estafa.';

revoke all on function public.send_message(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.send_message(uuid, text, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Notificación agrupada por conversación
-- ════════════════════════════════════════════════════════════════════════════
--
-- Una sola notificación sin leer por hilo. Sin esto, cada mensaje crearía una
-- fila y el panel de notificaciones se volvería inservible.

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_owner uuid;
  v_requester uuid;
  v_recipient uuid;
  v_link text;
  v_sender text;
  v_updated int;
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;

  select c.owner_profile_id, c.requester_profile_id
    into v_owner, v_requester
    from public.conversations c
   where c.id = new.conversation_id;

  v_recipient := case
    when new.sender_profile_id = v_owner then v_requester
    else v_owner
  end;

  v_link := '/mensajes/' || new.conversation_id::text;

  select pr.username into v_sender
    from public.profiles pr
   where pr.id = new.sender_profile_id;

  -- Evita que dos mensajes simultáneos creen dos notificaciones sin leer.
  perform pg_advisory_xact_lock(
    hashtextextended(v_recipient::text || ':' || new.conversation_id::text, 0)
  );

  update public.notifications
     set title = format('Nuevo mensaje de @%s', coalesce(v_sender, 'alguien')),
         body = left(new.body, 140),
         created_at = now(),
         is_read = false,
         read_at = null
   where profile_id = v_recipient
     and type = 'MESSAGE'
     and is_read = false
     and link = v_link;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    insert into public.notifications (profile_id, type, title, body, link)
    values (
      v_recipient,
      'MESSAGE',
      format('Nuevo mensaje de @%s', coalesce(v_sender, 'alguien')),
      left(new.body, 140),
      v_link
    );
  end if;

  return new;
end;
$fn$;

comment on function public.notify_chat_message() is
  'Actualiza last_message_at y mantiene una única notificación MESSAGE sin leer por conversación y destinatario.';

revoke all on function public.notify_chat_message() from public, anon, authenticated;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row
  execute function public.notify_chat_message();

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Archivo automático en solo lectura
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.sync_chat_archive()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if new.deleted_at is not null or new.status <> 'ACTIVE' then
    update public.conversations
       set archived_at = coalesce(archived_at, now())
     where publication_id = new.id
       and archived_at is null;
  else
    -- Reabrir una publicación por error no debe dejar el chat muerto.
    update public.conversations
       set archived_at = null
     where publication_id = new.id
       and archived_at is not null;
  end if;

  return new;
end;
$fn$;

comment on function public.sync_chat_archive() is
  'Archiva los hilos cuando la publicación deja de estar ACTIVE y los reabre si vuelve a estarlo.';

revoke all on function public.sync_chat_archive() from public, anon, authenticated;

drop trigger if exists publications_archive_chats on public.publications;
create trigger publications_archive_chats
  after update of status, deleted_at on public.publications
  for each row
  execute function public.sync_chat_archive();

-- Hard delete: se archiva antes de que la FK ponga publication_id a NULL, para
-- que el hilo quede cerrado y conservando la copia del título.
create or replace function public.archive_chats_on_publication_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.conversations
     set archived_at = coalesce(archived_at, now())
   where publication_id = old.id;

  return old;
end;
$fn$;

revoke all on function public.archive_chats_on_publication_delete() from public, anon, authenticated;

drop trigger if exists publications_archive_chats_delete on public.publications;
create trigger publications_archive_chats_delete
  before delete on public.publications
  for each row
  execute function public.archive_chats_on_publication_delete();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Lectura y contadores
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = '42501',
            hint = 'Inicia sesión para leer tus mensajes.';
  end if;

  if not exists (
    select 1
      from public.conversations c
     where c.id = p_conversation_id
       and (c.owner_profile_id = v_actor or c.requester_profile_id = v_actor)
  ) then
    raise exception 'not a conversation participant'
      using errcode = '42501',
            hint = 'No participas en esta conversación.';
  end if;

  insert into public.conversation_reads (conversation_id, profile_id, last_read_at)
  values (p_conversation_id, v_actor, now())
  on conflict (conversation_id, profile_id)
  do update set last_read_at = excluded.last_read_at;

  update public.notifications
     set is_read = true,
         read_at = now()
   where profile_id = v_actor
     and type = 'MESSAGE'
     and is_read = false
     and link = '/mensajes/' || p_conversation_id::text;
end;
$fn$;

comment on function public.mark_conversation_read(uuid) is
  'Marca el hilo como leído y apaga la notificación MESSAGE asociada. Solo para participantes.';

revoke all on function public.mark_conversation_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

/*
 * Bandeja de entrada. SECURITY INVOKER a propósito: la RLS de conversations y
 * publications sigue aplicando. Devuelve una fila por hilo con el resumen, el
 * otro participante y el contador de no leídos, para no hacer N+1 desde el
 * cliente.
 */
create or replace function public.get_conversations(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  conversation_id uuid,
  publication_id uuid,
  publication_title text,
  publication_slug text,
  publication_type text,
  publication_status text,
  publication_available boolean,
  cover_storage_path text,
  other_profile_id uuid,
  other_username text,
  other_avatar_url text,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint,
  archived_at timestamptz,
  contact_shared_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select
    c.id,
    c.publication_id,
    coalesce(p.title, c.publication_title),
    case when p.id is null then null else p.slug end,
    coalesce(p.type::text, c.publication_type::text),
    p.status::text,
    (p.id is not null and p.deleted_at is null and p.status in ('ACTIVE', 'RESOLVED')),
    img.storage_path,
    case
      when c.owner_profile_id = auth.uid() then c.requester_profile_id
      else c.owner_profile_id
    end,
    other.username,
    other.avatar_url,
    lm.body,
    lm.created_at,
    lm.sender_profile_id,
    coalesce(u.unread, 0)::bigint,
    c.archived_at,
    c.contact_shared_at
  from public.conversations c
  left join public.profiles other
    on other.id = case
      when c.owner_profile_id = auth.uid() then c.requester_profile_id
      else c.owner_profile_id
    end
  left join public.publications p on p.id = c.publication_id
  left join public.conversation_reads cr
    on cr.conversation_id = c.id and cr.profile_id = auth.uid()
  left join lateral (
    select m.body, m.created_at, m.sender_profile_id
      from public.messages m
     where m.conversation_id = c.id
       and m.deleted_at is null
     order by m.created_at desc
     limit 1
  ) lm on true
  left join lateral (
    select pi.storage_path
      from public.publication_images pi
     where pi.publication_id = c.publication_id
     order by pi.is_cover desc, pi.sort_order asc
     limit 1
  ) img on true
  left join lateral (
    select count(*) as unread
      from public.messages m
     where m.conversation_id = c.id
       and m.sender_profile_id <> auth.uid()
       and m.deleted_at is null
       and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
  ) u on true
  where c.owner_profile_id = auth.uid()
     or c.requester_profile_id = auth.uid()
  order by c.last_message_at desc, c.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$fn$;

comment on function public.get_conversations(integer, integer) is
  'Bandeja de entrada del usuario con resumen, otro participante y no leídos. RLS aplica (SECURITY INVOKER).';

revoke all on function public.get_conversations(integer, integer) from public, anon, authenticated;
grant execute on function public.get_conversations(integer, integer) to authenticated;

create or replace function public.unread_chat_count()
returns bigint
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(sum(u.unread), 0)::bigint
    from public.conversations c
    left join public.conversation_reads cr
      on cr.conversation_id = c.id and cr.profile_id = auth.uid()
    left join lateral (
      select count(*) as unread
        from public.messages m
       where m.conversation_id = c.id
         and m.sender_profile_id <> auth.uid()
         and m.deleted_at is null
         and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
    ) u on true
   where c.owner_profile_id = auth.uid()
      or c.requester_profile_id = auth.uid();
$fn$;

comment on function public.unread_chat_count() is
  'Total de mensajes sin leer del usuario. Pensado para el badge de la cabecera, separado del de notificaciones.';

revoke all on function public.unread_chat_count() from public, anon, authenticated;
grant execute on function public.unread_chat_count() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Compartir contacto con consentimiento
-- ════════════════════════════════════════════════════════════════════════════
--
-- `reveal_publication_contact` sigue siendo el camino con cuota. Estos dos RPC
-- cubren el caso explícito: el dueño pulsa "Compartir mi WhatsApp" y el
-- interesado puede leerlo sin gastar su cuota de 30/24 h, porque ya hay
-- consentimiento y queda registro.

create or replace function public.share_publication_contact(p_conversation_id uuid)
returns table(
  contact_phone text,
  contact_whatsapp text,
  contact_email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_conv record;
  v_pub record;
  v_first_share boolean;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = '42501',
            hint = 'Inicia sesión para compartir tu contacto.';
  end if;

  select c.owner_profile_id, c.requester_profile_id, c.publication_id, c.contact_shared_at, c.archived_at
    into v_conv
    from public.conversations c
   where c.id = p_conversation_id;

  if not found then
    raise exception 'conversation not found'
      using errcode = '42501',
            hint = 'La conversación no existe.';
  end if;

  if v_conv.archived_at is not null then
    raise exception 'conversation archived'
      using errcode = '23514',
            detail = jsonb_build_object(
              'code', 'CHAT_ARCHIVED',
              'message', 'Esta publicación fue resuelta. La conversación está cerrada.'
            )::text,
            hint = 'Esta conversación está cerrada.';
  end if;

  if v_conv.owner_profile_id <> v_actor then
    raise exception 'only the publication owner can share contact'
      using errcode = '42501',
            hint = 'Solo el dueño de la publicación puede compartir su contacto.';
  end if;

  if v_conv.publication_id is null then
    raise exception 'publication not available'
      using errcode = '42501',
            hint = 'La publicación ya no está disponible.';
  end if;

  select p.contact_phone, p.contact_whatsapp, p.contact_email
    into v_pub
    from public.publications p
   where p.id = v_conv.publication_id
     and p.owner_profile_id = v_actor;

  if not found then
    raise exception 'publication not available'
      using errcode = '42501',
            hint = 'La publicación ya no está disponible.';
  end if;

  if v_pub.contact_phone is null
     and v_pub.contact_whatsapp is null
     and v_pub.contact_email is null then
    raise exception 'publication has no contact data'
      using errcode = '42501',
            detail = jsonb_build_object(
              'code', 'CHAT_NO_CONTACT',
              'message', 'La publicación no tiene datos de contacto configurados.'
            )::text,
            hint = 'La publicación no tiene datos de contacto configurados.';
  end if;

  v_first_share := v_conv.contact_shared_at is null;

  if v_first_share then
    update public.conversations
       set contact_shared_at = now()
     where id = p_conversation_id;

    insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, metadata)
    values (
      v_actor,
      'CONTACT_SHARED',
      'conversation',
      p_conversation_id,
      jsonb_build_object('publication_id', v_conv.publication_id, 'via', 'chat')
    );

    insert into public.notifications (profile_id, type, title, body, link)
    values (
      v_conv.requester_profile_id,
      'MESSAGE',
      'Contacto compartido',
      'El dueño de la publicación compartió su contacto contigo.',
      '/mensajes/' || p_conversation_id::text
    );
  end if;

  return query
    select v_pub.contact_phone, v_pub.contact_whatsapp, v_pub.contact_email;
end;
$fn$;

comment on function public.share_publication_contact(uuid) is
  'El dueño comparte su contacto dentro del hilo. Audita la acción y avisa al interesado. Idempotente.';

revoke all on function public.share_publication_contact(uuid) from public, anon, authenticated;
grant execute on function public.share_publication_contact(uuid) to authenticated;

create or replace function public.get_shared_contact(p_conversation_id uuid)
returns table(
  contact_phone text,
  contact_whatsapp text,
  contact_email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_conv record;
  v_pub record;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = '42501',
            hint = 'Inicia sesión para ver el contacto.';
  end if;

  select c.owner_profile_id, c.requester_profile_id, c.publication_id, c.contact_shared_at
    into v_conv
    from public.conversations c
   where c.id = p_conversation_id
     and (c.owner_profile_id = v_actor or c.requester_profile_id = v_actor);

  if not found then
    raise exception 'not a conversation participant'
      using errcode = '42501',
            hint = 'No participas en esta conversación.';
  end if;

  if v_conv.contact_shared_at is null then
    raise exception 'contact not shared'
      using errcode = '42501',
            detail = jsonb_build_object(
              'code', 'CHAT_CONTACT_NOT_SHARED',
              'message', 'El dueño todavía no ha compartido su contacto.'
            )::text,
            hint = 'El dueño todavía no ha compartido su contacto.';
  end if;

  if v_conv.publication_id is null then
    raise exception 'publication not available'
      using errcode = '42501',
            hint = 'La publicación ya no está disponible.';
  end if;

  select p.contact_phone, p.contact_whatsapp, p.contact_email
    into v_pub
    from public.publications p
   where p.id = v_conv.publication_id;

  if not found then
    raise exception 'publication not available'
      using errcode = '42501',
            hint = 'La publicación ya no está disponible.';
  end if;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'CONTACT_VIEWED_SHARED',
    'conversation',
    p_conversation_id,
    jsonb_build_object('publication_id', v_conv.publication_id, 'via', 'chat')
  );

  return query
    select v_pub.contact_phone, v_pub.contact_whatsapp, v_pub.contact_email;
end;
$fn$;

comment on function public.get_shared_contact(uuid) is
  'Devuelve el contacto solo si el dueño lo compartió y el solicitante participa. Registra cada lectura en audit_logs.';

revoke all on function public.get_shared_contact(uuid) from public, anon, authenticated;
grant execute on function public.get_shared_contact(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. Moderación: solo contexto de un mensaje reportado
-- ════════════════════════════════════════════════════════════════════════════

/*
 * No existe ninguna política que deje a un moderador leer `messages` por su
 * cuenta: esta función es el único camino. Devuelve como máximo 51 mensajes
 * alrededor del reportado (±20 por defecto, tope ±50) y registra la lectura.
 */
create or replace function public.moderation_reported_context(
  p_report_id uuid,
  p_before integer default 20,
  p_after integer default 20
)
returns table(
  message_id uuid,
  sender_profile_id uuid,
  sender_username text,
  body text,
  created_at timestamptz,
  has_external_link boolean,
  has_phone boolean,
  is_reported boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_report record;
  v_before int;
  v_after int;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = '42501',
            hint = 'Inicia sesión.';
  end if;

  select pr.role into v_role
    from public.profiles pr
   where pr.id = v_actor;

  if coalesce(v_role, 'USER') not in ('MODERATOR', 'ADMIN') then
    raise exception 'moderator role required'
      using errcode = '42501',
            hint = 'Solo el equipo de moderación puede revisar conversaciones reportadas.';
  end if;

  select r.id, r.message_id, r.conversation_id, m.created_at as message_created_at
    into v_report
    from public.message_reports r
    join public.messages m on m.id = r.message_id
   where r.id = p_report_id;

  if not found then
    raise exception 'message report not found'
      using errcode = '42501',
            hint = 'El reporte no existe.';
  end if;

  v_before := least(greatest(coalesce(p_before, 20), 0), 50);
  v_after := least(greatest(coalesce(p_after, 20), 0), 50);

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'CHAT_MODERATION_VIEW',
    'message_report',
    p_report_id,
    jsonb_build_object(
      'conversation_id', v_report.conversation_id,
      'message_id', v_report.message_id,
      'before', v_before,
      'after', v_after
    )
  );

  return query
  with around as (
    (
      select m.*
        from public.messages m
       where m.conversation_id = v_report.conversation_id
         and m.created_at <= v_report.message_created_at
       order by m.created_at desc
       limit v_before + 1
    )
    union all
    (
      select m.*
        from public.messages m
       where m.conversation_id = v_report.conversation_id
         and m.created_at > v_report.message_created_at
       order by m.created_at asc
       limit v_after
    )
  )
  select
    a.id,
    a.sender_profile_id,
    pr.username,
    a.body,
    a.created_at,
    a.has_external_link,
    a.has_phone,
    (a.id = v_report.message_id)
  from around a
  join public.profiles pr on pr.id = a.sender_profile_id
  order by a.created_at asc;
end;
$fn$;

comment on function public.moderation_reported_context(uuid, integer, integer) is
  'Único camino para que moderación lea un hilo: solo desde un reporte, con contexto limitado y auditoría obligatoria.';

revoke all on function public.moderation_reported_context(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.moderation_reported_context(uuid, integer, integer) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 11. Retención de hilos archivados
-- ════════════════════════════════════════════════════════════════════════════
--
-- 90 días por defecto. Solo service_role: se espera un cron externo, igual que
-- el resto de tareas de mantenimiento. Borrar el hilo arrastra mensajes,
-- lecturas y reportes por las FK.

create or replace function public.purge_archived_conversations(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_days int;
  v_deleted int;
begin
  v_days := least(greatest(coalesce(p_days, 90), 1), 3650);

  -- Las notificaciones del hilo apuntan a una URL que deja de existir: se
  -- borran en la misma transacción para no dejar enlaces muertos en "Avisos".
  with purged as (
    delete from public.conversations
     where archived_at is not null
       and archived_at < now() - make_interval(days => v_days)
    returning id
  ), removed_notifications as (
    delete from public.notifications n
     using purged p
     where n.link = '/mensajes/' || p.id::text
  )
  select count(*) into v_deleted from purged;

  return v_deleted;
end;
$fn$;

comment on function public.purge_archived_conversations(integer) is
  'Borra hilos archivados hace más de N días (90 por defecto). Solo service_role; pensado para un cron.';

revoke all on function public.purge_archived_conversations(integer) from public, anon, authenticated;
grant execute on function public.purge_archived_conversations(integer) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 12. Realtime
-- ════════════════════════════════════════════════════════════════════════════
--
-- Los INSERT de mensajes se emiten por Realtime. La RLS de SELECT decide qué
-- recibe cada conexión, así que no hace falta filtrar en el servidor.

do $do$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$do$;

-- ════════════════════════════════════════════════════════════════════════════
-- 13. Rate limit de reportes
-- ════════════════════════════════════════════════════════════════════════════

drop trigger if exists message_reports_rate_limit on public.message_reports;
create trigger message_reports_rate_limit
  before insert on public.message_reports
  for each row
  execute function public.tg_rate_limit('message_report', 'reporter_profile_id', 'hour', '10', '3');
