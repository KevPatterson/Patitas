-- ════════════════════════════════════════════════════════════════════════════
-- Migración 0017 — Adopciones: notas, notificación y reglas en la BD
-- ════════════════════════════════════════════════════════════════════════════
--
-- Tarea 5.2 del plan. Tres cosas:
--
--   1. `adoption_requests` no tenía dónde guardar las notas del dueño al
--      aceptar o rechazar.
--   2. La notificación al solicitante la insertaba el CLIENTE
--      (`updateAdoptionRequestStatus` en adoption-requests.ts). Desde la 0013 la
--      inserción en `notifications` es exclusiva del service role, así que ese
--      insert fallaba en silencio: el solicitante no se enteraba de nada. Se
--      mueve a un trigger, que es donde no se puede saltar.
--   3. Las reglas de negocio vivían solo en la app:
--        - no se puede solicitar tu propia publicación,
--        - no se puede duplicar una solicitud viva.
--      Se fuerzan en la base de datos, que es la única capa que no se puede
--      esquivar con supabase-js.
--
-- Idempotente.
--
-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────────────
--   drop trigger if exists adoption_requests_notify_status on public.adoption_requests;
--   drop function if exists public.notify_adoption_status_change();
--   drop trigger if exists adoption_requests_validate on public.adoption_requests;
--   drop function if exists public.validate_adoption_request();
--   drop index if exists public.adoption_requests_unique_active_idx;
--   alter table public.adoption_requests drop column if exists owner_notes;
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Notas del dueño
-- ════════════════════════════════════════════════════════════════════════════

alter table public.adoption_requests
  add column if not exists owner_notes text;

comment on column public.adoption_requests.owner_notes is
  'Nota privada del dueño de la publicación al aceptar o rechazar (máx. 1000 caracteres).';

do $do$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'adoption_requests_owner_notes_len'
       and conrelid = 'public.adoption_requests'::regclass
  ) then
    alter table public.adoption_requests
      add constraint adoption_requests_owner_notes_len
      check (owner_notes is null or char_length(owner_notes) <= 1000);
  end if;
end
$do$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Una sola solicitud viva por (publicación, solicitante)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Índice parcial: se permite volver a solicitar después de que la anterior haya
-- terminado (REJECTED o CANCELLED), pero no tener dos PENDING/ACCEPTED a la vez.

drop index if exists public.adoption_requests_unique_active_idx;

create unique index adoption_requests_unique_active_idx
  on public.adoption_requests (publication_id, requester_profile_id)
  where status in ('PENDING', 'ACCEPTED') and deleted_at is null;

comment on index public.adoption_requests_unique_active_idx is
  'Impide duplicar solicitudes de adopción vivas (PENDING/ACCEPTED) para la misma publicación y solicitante.';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Prohibir solicitar tu propia publicación
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.validate_adoption_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_owner uuid;
begin
  select p.owner_profile_id into v_owner
    from public.publications p
   where p.id = new.publication_id;

  if v_owner is null then
    raise exception 'publication not found'
      using errcode = '23503',
            hint = 'La publicación no existe o no admite solicitudes.';
  end if;

  if v_owner = new.requester_profile_id then
    raise exception 'cannot request own publication'
      using errcode = '23514',
            detail = json_build_object(
              'code', 'OWN_PUBLICATION',
              'message', 'No puedes solicitar la adopción de tu propia publicación.'
            )::text,
            hint = 'No puedes solicitar la adopción de tu propia publicación.';
  end if;

  return new;
end;
$fn$;

revoke all on function public.validate_adoption_request() from public, anon, authenticated;

drop trigger if exists adoption_requests_validate on public.adoption_requests;

create trigger adoption_requests_validate
  before insert on public.adoption_requests
  for each row
  execute function public.validate_adoption_request();

comment on function public.validate_adoption_request() is
  'Bloquea solicitar la adopción de una publicación propia, incluso llamando a la API de Supabase directamente.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Notificación al cambiar el estado
-- ════════════════════════════════════════════════════════════════════════════
--
-- Antes lo hacía el cliente y, desde que la 0013 cerró la inserción de
-- notificaciones a `authenticated`, fallaba en silencio. Un trigger con
-- SECURITY DEFINER sí puede insertarlas.

create or replace function public.notify_adoption_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_title text;
  v_publication_title text;
begin
  -- Solo cuando el estado cambia a algo relevante para el solicitante.
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('ACCEPTED', 'REJECTED', 'CANCELLED') then
    return new;
  end if;

  select p.title into v_publication_title
    from public.publications p
   where p.id = new.publication_id;

  v_title := case new.status
    when 'ACCEPTED' then '¡Solicitud aceptada!'
    when 'REJECTED' then 'Solicitud rechazada'
    else 'Solicitud cancelada'
  end;

  insert into public.notifications (profile_id, type, title, body, link)
  values (
    new.requester_profile_id,
    'PUBLICATION_UPDATE',
    v_title,
    format(
      'Tu solicitud de adopción para "%s" %s.',
      coalesce(v_publication_title, 'la publicación'),
      case new.status
        when 'ACCEPTED' then 'fue aceptada. El dueño se pondrá en contacto contigo'
        when 'REJECTED' then 'fue rechazada'
        else 'fue cancelada'
      end
    ),
    '/dashboard'
  );

  return new;
end;
$fn$;

revoke all on function public.notify_adoption_status_change() from public, anon, authenticated;

drop trigger if exists adoption_requests_notify_status on public.adoption_requests;

create trigger adoption_requests_notify_status
  after update of status on public.adoption_requests
  for each row
  execute function public.notify_adoption_status_change();

comment on function public.notify_adoption_status_change() is
  'Avisa al solicitante cuando su solicitud pasa a ACCEPTED, REJECTED o CANCELLED. Sustituye al insert que hacía el cliente.';
