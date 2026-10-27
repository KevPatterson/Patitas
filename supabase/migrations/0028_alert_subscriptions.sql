-- 0028_alert_subscriptions.sql
-- Alertas por municipio, solo dentro de la bandeja de notificaciones.
--
-- Cómo funciona:
--   1. Cada usuario puede guardar un municipio y los tipos de caso que le
--      interesan (perdidos, encontrados y avistamientos).
--   2. Al insertarse una publicación nueva, un trigger busca suscripciones del
--      mismo municipio y crea una notificación para cada una.
--   3. El índice único (profile_id, publication_id) evita avisos duplicados si
--      la publicación se reintenta o se vuelve a insertar.
--
-- Decisiones:
--   - No se guardan coordenadas: el alcance es el municipio. Así no hace falta
--     pedir GPS ni almacenar ubicación personal.
--   - Las publicaciones importadas no disparan alertas para no inundar la
--     bandeja con casos de fuentes externas.
--   - El fan-out se limita a 200 destinatarios por publicación.
--
-- La migración es idempotente: se puede reaplicar sin duplicar objetos.

-- ---------------------------------------------------------------------------
-- 1. Suscripciones
-- ---------------------------------------------------------------------------

create table if not exists public.alert_subscriptions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  province text not null,
  municipality text not null,
  types public.publication_type[] not null
    default array['LOST', 'FOUND', 'SIGHTING']::public.publication_type[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alert_subscriptions_scope_check
    check (
      char_length(btrim(province)) between 2 and 80
      and char_length(btrim(municipality)) between 2 and 80
    ),
  constraint alert_subscriptions_types_check
    check (
      cardinality(types) > 0
      and types <@ array['LOST', 'FOUND', 'SIGHTING']::public.publication_type[]
    )
);

-- El fan-out filtra por provincia, municipio y estado: sin este índice cada
-- publicación nueva recorrería la tabla completa.
create index if not exists alert_subscriptions_scope_idx
  on public.alert_subscriptions (province, municipality, is_active);

drop trigger if exists alert_subscriptions_set_updated_at on public.alert_subscriptions;

create trigger alert_subscriptions_set_updated_at
  before update on public.alert_subscriptions
  for each row
  execute function public.set_updated_at();

alter table public.alert_subscriptions enable row level security;

drop policy if exists "owners manage own alert subscription" on public.alert_subscriptions;

create policy "owners manage own alert subscription"
on public.alert_subscriptions for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

revoke all on public.alert_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.alert_subscriptions to authenticated;

comment on table public.alert_subscriptions is
  'Municipio y tipos de caso que el usuario quiere recibir en su bandeja. Sin coordenadas ni GPS.';

-- ---------------------------------------------------------------------------
-- 2. Deduplicación de avisos por publicación
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists publication_id uuid references public.publications(id) on delete cascade;

create unique index if not exists notifications_profile_publication_unique_idx
  on public.notifications (profile_id, publication_id)
  where publication_id is not null;

comment on column public.notifications.publication_id is
  'Publicación que originó el aviso. Sirve para no repetir alertas del mismo caso.';

-- ---------------------------------------------------------------------------
-- 3. Fan-out al publicar un caso
-- ---------------------------------------------------------------------------

create or replace function public.notify_municipality_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_province text;
  v_municipality text;
  v_zone text;
  v_type_label text;
  v_body text;
begin
  if new.status <> 'ACTIVE' or new.deleted_at is not null then
    return new;
  end if;

  if new.type not in ('LOST', 'FOUND', 'SIGHTING') then
    return new;
  end if;

  -- Las importaciones pueden llegar en lote; no deben inundar la bandeja.
  if coalesce(new.is_imported, false) then
    return new;
  end if;

  select l.province, l.municipality, l.zone
    into v_province, v_municipality, v_zone
    from public.locations l
   where l.id = new.location_id;

  if v_province is null or v_municipality is null then
    return new;
  end if;

  v_type_label := case new.type
    when 'LOST' then 'mascota perdida'
    when 'FOUND' then 'mascota encontrada'
    else 'avistamiento'
  end;

  v_body := format(
    'Se publicó un caso de %s en %s%s. Revisa si puedes ayudar.',
    v_type_label,
    v_municipality,
    case
      when v_zone is not null and btrim(v_zone) <> '' then ', ' || btrim(v_zone)
      else ''
    end
  );

  insert into public.notifications (profile_id, type, title, body, link, publication_id)
  select
    s.profile_id,
    'ALERT',
    format('Nueva alerta en %s', v_municipality),
    v_body,
    '/p/' || new.slug,
    new.id
  from public.alert_subscriptions s
  where s.is_active
    and s.province = v_province
    and s.municipality = v_municipality
    and s.profile_id <> new.owner_profile_id
    and new.type = any(s.types)
  order by s.created_at
  limit 200
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.notify_municipality_alert() from public, anon, authenticated;

drop trigger if exists publications_notify_municipality_alert on public.publications;

create trigger publications_notify_municipality_alert
after insert on public.publications
for each row
execute function public.notify_municipality_alert();
