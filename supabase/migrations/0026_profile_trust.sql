-- 0026_profile_trust.sql
-- Verificación de perfiles y reencuentros confirmados.
--
-- Objetivo:
--   1. Permitir que un usuario solicite una verificación (rescatista, refugio,
--      veterinaria u organización) y que un moderador la apruebe o rechace.
--   2. Registrar reencuentros confirmados por ambas partes de un caso resuelto,
--      que es la base de la reputación pública del perfil.
--
-- Decisiones de seguridad:
--   - La verificación vive en una tabla aparte y NO en `profiles`: la política
--     de actualización de perfiles permite al dueño editar su fila, así que un
--     campo `verified_at` en `profiles` sería escribible por el usuario.
--   - `evidence_url` y `note` no tienen SELECT para `authenticated`: pueden
--     contener documentos personales. Solo los lee el service role (API de
--     administración).
--   - Los reencuentros se insertan únicamente por RPC, nunca con INSERT directo,
--     y exigen participación real en el caso (chat, avistamiento, comentario o
--     revelación de contacto).
--
-- La migración es idempotente: se puede reaplicar sin duplicar objetos.

do $$ begin
  create type public.verification_kind as enum ('RESCUER', 'SHELTER', 'VET', 'ORG');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Solicitudes de verificación
-- ---------------------------------------------------------------------------

create table if not exists public.profile_verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind public.verification_kind not null,
  status public.verification_status not null default 'PENDING',
  evidence_url text,
  note text,
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_verifications_evidence_url_check
    check (evidence_url is null or (evidence_url ~ '^https://' and char_length(evidence_url) <= 500)),
  constraint profile_verifications_note_check
    check (note is null or char_length(note) <= 500),
  constraint profile_verifications_review_notes_check
    check (review_notes is null or char_length(review_notes) <= 500)
);

-- Una sola solicitud activa por perfil. Si se rechaza, puede volver a intentarlo.
create unique index if not exists profile_verifications_one_active_idx
  on public.profile_verifications (profile_id)
  where status in ('PENDING', 'APPROVED');

create index if not exists profile_verifications_status_idx
  on public.profile_verifications (status, created_at desc);

drop trigger if exists profile_verifications_set_updated_at on public.profile_verifications;

create trigger profile_verifications_set_updated_at
  before update on public.profile_verifications
  for each row
  execute function public.set_updated_at();

alter table public.profile_verifications enable row level security;

-- Las verificaciones aprobadas son públicas para pintar el badge.
drop policy if exists "approved verifications are public" on public.profile_verifications;

create policy "approved verifications are public"
on public.profile_verifications for select
using (status = 'APPROVED');

drop policy if exists "owners can read own verification" on public.profile_verifications;

create policy "owners can read own verification"
on public.profile_verifications for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists "moderators can read verifications" on public.profile_verifications;

create policy "moderators can read verifications"
on public.profile_verifications for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role in ('MODERATOR', 'ADMIN')
  )
);

drop policy if exists "owners can request verification" on public.profile_verifications;

create policy "owners can request verification"
on public.profile_verifications for insert
to authenticated
with check (profile_id = auth.uid() and status = 'PENDING');

drop policy if exists "owners can cancel pending verification" on public.profile_verifications;

create policy "owners can cancel pending verification"
on public.profile_verifications for delete
to authenticated
using (profile_id = auth.uid() and status = 'PENDING');

-- Privilegios por columna: el público solo ve lo necesario para el badge.
revoke all on public.profile_verifications from anon, authenticated;
grant select (id, profile_id, kind, status, created_at, reviewed_at)
  on public.profile_verifications to anon, authenticated;
grant insert (profile_id, kind, evidence_url, note)
  on public.profile_verifications to authenticated;
grant delete on public.profile_verifications to authenticated;

comment on table public.profile_verifications is
  'Solicitudes de verificación revisadas por moderación. La evidencia no es legible por el cliente.';

-- ---------------------------------------------------------------------------
-- 2. Reencuentros confirmados
-- ---------------------------------------------------------------------------

create table if not exists public.reunion_confirmations (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint reunion_confirmations_role_check check (role in ('OWNER', 'FINDER')),
  constraint reunion_confirmations_unique_profile unique (publication_id, profile_id)
);

create index if not exists reunion_confirmations_publication_idx
  on public.reunion_confirmations (publication_id, role);

create index if not exists reunion_confirmations_profile_idx
  on public.reunion_confirmations (profile_id, created_at desc);

alter table public.reunion_confirmations enable row level security;

-- Solo las partes del caso y la moderación pueden ver las confirmaciones.
drop policy if exists "participants can read reunion confirmations" on public.reunion_confirmations;

create policy "participants can read reunion confirmations"
on public.reunion_confirmations for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.publications p
     where p.id = publication_id
       and p.owner_profile_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles pr
     where pr.id = auth.uid()
       and pr.role in ('MODERATOR', 'ADMIN')
  )
);

revoke all on public.reunion_confirmations from anon, authenticated;
grant select on public.reunion_confirmations to authenticated;

comment on table public.reunion_confirmations is
  'Confirmaciones de reencuentro por caso. Se insertan solo por RPC y exigen participación real.';

-- ---------------------------------------------------------------------------
-- 3. Reputación pública
-- ---------------------------------------------------------------------------

create or replace function public.get_profile_reputation(p_profile_id uuid)
returns table(reunions_confirmed integer, rescues_confirmed integer)
language sql
stable
security definer
set search_path = public
as $$
  with owned as (
    select p.id
      from public.publications p
     where p.owner_profile_id = p_profile_id
       and p.status = 'RESOLVED'
       and p.deleted_at is null
       and exists (
         select 1 from public.reunion_confirmations c
          where c.publication_id = p.id
            and c.profile_id = p_profile_id
            and c.role = 'OWNER'
       )
       and exists (
         select 1 from public.reunion_confirmations c
          where c.publication_id = p.id
            and c.role = 'FINDER'
       )
  ),
  rescued as (
    select c.publication_id
      from public.reunion_confirmations c
      join public.publications p on p.id = c.publication_id
     where c.profile_id = p_profile_id
       and c.role = 'FINDER'
       and p.status = 'RESOLVED'
       and p.deleted_at is null
       and exists (
         select 1 from public.reunion_confirmations o
          where o.publication_id = c.publication_id
            and o.role = 'OWNER'
       )
  )
  select
    (select count(*)::integer from owned) as reunions_confirmed,
    (select count(*)::integer from rescued) as rescues_confirmed;
$$;

comment on function public.get_profile_reputation(uuid) is
  'Reencuentros confirmados por ambas partes: como dueño y como quien encontró a la mascota.';

revoke all on function public.get_profile_reputation(uuid) from public, anon, authenticated;
grant execute on function public.get_profile_reputation(uuid) to anon, authenticated, service_role;

create or replace function public.get_publication_reunion_status(p_publication_id uuid)
returns table(
  owner_confirmed boolean,
  finder_confirmed boolean,
  my_role text,
  total_confirmations integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.reunion_confirmations c
       where c.publication_id = p_publication_id
         and c.role = 'OWNER'
    ) as owner_confirmed,
    exists (
      select 1 from public.reunion_confirmations c
       where c.publication_id = p_publication_id
         and c.role = 'FINDER'
    ) as finder_confirmed,
    (
      select c.role from public.reunion_confirmations c
       where c.publication_id = p_publication_id
         and c.profile_id = auth.uid()
    ) as my_role,
    (
      select count(*)::integer from public.reunion_confirmations c
       where c.publication_id = p_publication_id
    ) as total_confirmations;
$$;

revoke all on function public.get_publication_reunion_status(uuid) from public, anon, authenticated;
grant execute on function public.get_publication_reunion_status(uuid) to authenticated, service_role;

create or replace function public.confirm_reunion(p_publication_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status public.publication_status;
  v_deleted_at timestamptz;
  v_slug text;
  v_title text;
  v_role text;
  v_inserted uuid;
  v_counterpart uuid;
  v_actor_name text;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = '42501',
            hint = 'Inicia sesión para confirmar un reencuentro.';
  end if;

  select p.owner_profile_id, p.status, p.deleted_at, p.slug, p.title
    into v_owner, v_status, v_deleted_at, v_slug, v_title
    from public.publications p
   where p.id = p_publication_id;

  if not found or v_deleted_at is not null then
    raise exception 'publication not available'
      using errcode = '42501',
            hint = 'La publicación no está disponible.';
  end if;

  if v_status <> 'RESOLVED' then
    raise exception 'publication is not resolved'
      using errcode = '42501',
            hint = 'Solo puedes confirmar el reencuentro de un caso marcado como resuelto.';
  end if;

  if v_owner = v_actor then
    v_role := 'OWNER';
  else
    v_role := 'FINDER';

    -- Solo quien participó de verdad puede confirmar como quien encontró a la
    -- mascota. Se acepta chat, avistamiento, comentario o revelación de contacto.
    if not exists (
      select 1 from public.conversations c
       where c.publication_id = p_publication_id
         and c.requester_profile_id = v_actor
    ) and not exists (
      select 1 from public.sightings s
       where s.publication_id = p_publication_id
         and s.reporter_profile_id = v_actor
         and s.deleted_at is null
    ) and not exists (
      select 1 from public.comments cm
       where cm.publication_id = p_publication_id
         and cm.author_profile_id = v_actor
         and cm.deleted_at is null
    ) and not exists (
      select 1 from public.contact_reveals cr
       where cr.publication_id = p_publication_id
         and cr.profile_id = v_actor
    ) then
      raise exception 'participation required'
        using errcode = '42501',
              hint = 'Solo quienes participaron en el caso pueden confirmar el reencuentro.';
    end if;
  end if;

  insert into public.reunion_confirmations (publication_id, profile_id, role)
  values (p_publication_id, v_actor, v_role)
  on conflict (publication_id, profile_id) do nothing
  returning id into v_inserted;

  -- Si ya estaba confirmado, no se repite la notificación.
  if v_inserted is null then
    return v_role;
  end if;

  if v_role = 'OWNER' then
    for v_counterpart in
      select c.profile_id
        from public.reunion_confirmations c
       where c.publication_id = p_publication_id
         and c.role = 'FINDER'
    loop
      insert into public.notifications (profile_id, type, title, body, link)
      values (
        v_counterpart,
        'PUBLICATION_UPDATE',
        'Reencuentro confirmado',
        format('El dueño de "%s" confirmó el reencuentro. ¡Gracias por ayudar!', v_title),
        '/p/' || v_slug
      );
    end loop;
  else
    select pr.username into v_actor_name
      from public.profiles pr
     where pr.id = v_actor;

    insert into public.notifications (profile_id, type, title, body, link)
    values (
      v_owner,
      'PUBLICATION_UPDATE',
      'Reencuentro confirmado',
      format('@%s confirmó que participó en el reencuentro de "%s".', coalesce(v_actor_name, 'un usuario'), v_title),
      '/p/' || v_slug
    );
  end if;

  return v_role;
end;
$$;

comment on function public.confirm_reunion(uuid) is
  'Confirma un reencuentro como dueño o como quien encontró a la mascota. Solo sobre casos RESOLVED y con participación previa.';

revoke all on function public.confirm_reunion(uuid) from public, anon, authenticated;
grant execute on function public.confirm_reunion(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Aviso al usuario cuando cambia el estado de su verificación
-- ---------------------------------------------------------------------------

create or replace function public.notify_verification_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'APPROVED' then
    insert into public.notifications (profile_id, type, title, body, link)
    values (
      new.profile_id,
      'SYSTEM',
      'Verificación aprobada',
      'Tu perfil ya muestra el badge de confianza. Gracias por ayudar a la comunidad.',
      '/dashboard'
    );
  elsif new.status = 'REJECTED' then
    insert into public.notifications (profile_id, type, title, body, link)
    values (
      new.profile_id,
      'SYSTEM',
      'Verificación no aprobada',
      'No pudimos validar tu solicitud. Puedes volver a intentarlo con más detalles.',
      '/dashboard'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_verification_status_change() from public, anon, authenticated;

drop trigger if exists profile_verifications_notify_status on public.profile_verifications;

create trigger profile_verifications_notify_status
after update of status on public.profile_verifications
for each row
execute function public.notify_verification_status_change();
