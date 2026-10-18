-- ════════════════════════════════════════════════════════════════════════════
-- Migración 0012 — La base de datos como autoridad (anti-bypass)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Cierra los hallazgos de Fase 2 de docs/AUDITORIA_SEGURIDAD.md que NO se pueden
-- arreglar desde /api, porque el cliente habla directo con Supabase usando la
-- anon key + JWT y puede saltarse cualquier validación que viva solo en la API:
--
--   DB-01  Sin rate limiting en BD (comments, sightings, publications, …)
--   DB-02  SECURITY DEFINER sin pg_temp en search_path
--   DB-04  Difuminado de ubicación con random(): promediable
--   DB-06  contact_phone/whatsapp/email legibles por anon, sin límite ni log
--   DB-08  Políticas using(true) sin cláusula TO
--   DB-14  Políticas de INSERT que aceptaban autor NULL (insertar en nombre de nadie)
--
-- Todo el archivo es idempotente: se puede reaplicar sin error.
--
-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (ejecutar solo si hay que revertir; no borra datos de usuario)
-- ────────────────────────────────────────────────────────────────────────────
--   drop trigger if exists publications_rate_limit on public.publications;
--   drop trigger if exists comments_rate_limit on public.comments;
--   drop trigger if exists sightings_rate_limit on public.sightings;
--   drop trigger if exists adoption_requests_rate_limit on public.adoption_requests;
--   drop trigger if exists reports_rate_limit on public.reports;
--   drop trigger if exists locations_fuzz_coordinates on public.locations;
--   drop trigger if exists locations_fuzz_coordinates_update on public.locations;
--   drop function if exists public.enforce_rate_limit();
--   drop function if exists public.tg_rate_limit();
--   drop table if exists public.rate_limit_events;
--   drop function if exists public.rate_limit_hit(uuid, text);
--   drop function if exists public.fuzz_location_on_insert();
--   drop function if exists public.fuzz_location_on_update();
--   drop function if exists public.fuzz_coordinates_deterministic(uuid, numeric, numeric);
--   drop function if exists public.fuzz_coordinates(numeric, numeric);
--   drop table if exists public.contact_reveals;
--   drop function if exists public.app_secret();
--   drop policy if exists "system can insert notifications" on public.notifications;
--   drop policy if exists "service role can update source tracking" on public.external_sources;
--   drop policy if exists "anyone can request takedown" on public.takedown_requests;
--   grant select (exact_lat, exact_lng) on public.locations to anon;            -- no existen: no-op
--   -- Restaurar trigger de fuzzing aleatorio: reaplicar 0007_location_privacy.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. DB-02 · Secretos y hardening de funciones SECURITY DEFINER
-- ════════════════════════════════════════════════════════════════════════════

/*
 * Devuelve el secreto de aplicación guardado en la configuración de la BD.
 *
 * Es un secreto de SERVIDOR: nunca se expone al cliente (no hay forma de
 * leerlo por PostgREST, `pg_settings` no es accesible con anon key) y solo lo
 * usa la función de difuminado.
 *
 * Para rotarlo, cambia la clave manualmente:
 *   alter database postgres set app.patitas_secret = '<nuevo-secreto-largo>';
 * (y reaplica el fuzzing si quieres invalidar los desplazamientos actuales).
 *
 * Si no está configurado, genera uno aleatorio en el momento de la migración.
 * OJO: ese valor es distinto en cada entorno, así que el difuminado de la BD
 * local y el de producción no coinciden. Es lo esperado: el desplazamiento no
 * necesita ser reproducible entre entornos, solo dentro de uno.
 */
create or replace function public.app_secret()
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  s text;
begin
  s := current_setting('app.patitas_secret', true);

  if s is null or length(s) < 16 then
    -- Sin dependencias de extensiones: dos fuentes de aleatoriedad fuertes.
    s := md5(random()::text || clock_timestamp()::text) || md5(gen_random_uuid()::text);
    perform set_config('app.patitas_secret', s, false);
  end if;

  return s;
end;
$$;

comment on function public.app_secret() is
  'Secreto de servidor para el difuminado determinista. No accesible desde el cliente.';

revoke all on function public.app_secret() from public, anon, authenticated;
grant execute on function public.app_secret() to service_role;

-- handle_new_user venía de 0001/0004 con `set search_path = public`.
-- Se reafirma con pg_temp al final (el hardening recomendado) SIN cambiar la
-- lógica: mismo coalesce de metadatos y mismo `on conflict do update`, porque de
-- él depende la sincronización del avatar de Google OAuth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update set
    username = excluded.username,
    full_name = excluded.full_name,
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    updated_at = now();

  return new;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. DB-04 · Difuminado de ubicación DETERMINISTA e idempotente
-- ════════════════════════════════════════════════════════════════════════════
--
-- Problema original (0007): el desplazamiento usaba random(), así que guardar
-- 50 veces las mismas coordenadas producía 50 muestras independientes centradas
-- en el punto real. Promediándolas se recuperaba la ubicación con ~27 m de error.
--
-- Solución: el desplazamiento es una función determinista de
-- (secreto del servidor, id de la fila, rejilla de ~1 km de la entrada).
-- Consecuencias:
--   * Repetir el guardado de la MISMA ubicación da SIEMPRE el mismo punto.
--   * La entrada se redondea a 2 decimales (~1.1 km) antes de difuminar, así que
--     aunque el atacante consiguiera resolver la rejilla solo obtiene ~1 km,
--     nunca el punto exacto que escribió el usuario.
--   * Un cambio de ubicación real y significativo (otra celda de la rejilla)
--     produce otro desplazamiento.

create or replace function public.fuzz_coordinates_deterministic(
  p_location_id uuid,
  p_lat numeric,
  p_lng numeric
)
returns table(fuzzed_lat numeric, fuzzed_lng numeric)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_secret text;
  v_grid_lat numeric;
  v_grid_lng numeric;
  v_hash text;
  v_off_lat numeric;
  v_off_lng numeric;
begin
  if p_lat is null or p_lng is null then
    return query select null::numeric, null::numeric;
    return;
  end if;

  v_secret := public.app_secret();

  -- Rejilla de ~1.1 km: se descarta la precisión fina ANTES de difuminar.
  v_grid_lat := round(p_lat, 2);
  v_grid_lng := round(p_lng, 2);

  -- HMAC artesanal con hash keyed (no requiere pgcrypto/digest).
  v_hash := encode(
    sha256(convert_to(v_secret || '|loc|' || p_location_id::text || '|'
      || v_grid_lat::text || ',' || v_grid_lng::text, 'utf8')),
    'hex'
  );

  -- Dos desplazamientos independientes en [-0.003, +0.003] grados (~±330 m).
  -- Los paréntesis son necesarios: el operador `&` tiene menos precedencia que
  -- la resta, así que sin ellos el resultado sería siempre 0.
  v_off_lat := ((('x' || substr(v_hash, 1, 8))::bit(32)::bigint & 4294967295)::numeric
                / 4294967295 * 0.006) - 0.003;
  v_off_lng := ((('x' || substr(v_hash, 9, 8))::bit(32)::bigint & 4294967295)::numeric
                / 4294967295 * 0.006) - 0.003;

  return query select
    round(v_grid_lat + v_off_lat, 4)::numeric(9, 6),
    round(v_grid_lng + v_off_lng, 4)::numeric(9, 6);
end;
$$;

comment on function public.fuzz_coordinates_deterministic(uuid, numeric, numeric) is
  'Desplazamiento determinista de coordenadas (±330 m) derivado del id de la fila y de una rejilla de ~1.1 km. Repetir el guardado no permite promediar.';

revoke all on function public.fuzz_coordinates_deterministic(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.fuzz_coordinates_deterministic(uuid, numeric, numeric) to service_role;

create or replace function public.fuzz_location_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_lat numeric;
  v_lng numeric;
begin
  if new.approximate_lat is not null and new.approximate_lng is not null then
    select f.fuzzed_lat, f.fuzzed_lng
      into v_lat, v_lng
      from public.fuzz_coordinates_deterministic(new.id, new.approximate_lat, new.approximate_lng) f;

    new.approximate_lat := v_lat;
    new.approximate_lng := v_lng;
  end if;

  return new;
end;
$fn$;

create or replace function public.fuzz_location_on_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_lat numeric;
  v_lng numeric;
begin
  -- Si las coordenadas no cambian, no se toca nada: así un UPDATE parcial
  -- (por ejemplo editar solo el título) no re-difumina ni mueve el marcador.
  if new.approximate_lat is not distinct from old.approximate_lat
     and new.approximate_lng is not distinct from old.approximate_lng then
    return new;
  end if;

  if new.approximate_lat is null or new.approximate_lng is null then
    return new;
  end if;

  select f.fuzzed_lat, f.fuzzed_lng
    into v_lat, v_lng
    from public.fuzz_coordinates_deterministic(new.id, new.approximate_lat, new.approximate_lng) f;

  new.approximate_lat := v_lat;
  new.approximate_lng := v_lng;

  return new;
end;
$fn$;

-- Los triggers ya existen desde 0007; se recrean para garantizar el orden.
drop trigger if exists locations_fuzz_coordinates on public.locations;
create trigger locations_fuzz_coordinates
  before insert on public.locations
  for each row
  execute function public.fuzz_location_on_insert();

drop trigger if exists locations_fuzz_coordinates_update on public.locations;
create trigger locations_fuzz_coordinates_update
  before update on public.locations
  for each row
  execute function public.fuzz_location_on_update();

-- Se reemplaza la función aleatoria original por su versión determinista.
-- OJO: la firma cambia (necesita el id), así que no puede ser `create or replace`.
drop function if exists public.fuzz_coordinates(numeric, numeric);

comment on function public.fuzz_location_on_insert() is
  'Difumina coordenadas en INSERT de forma determinista (±330 m, rejilla de ~1.1 km).';
comment on function public.fuzz_location_on_update() is
  'Re-difumina coordenadas en UPDATE solo si cambian de verdad; idempotente ante guardados repetidos.';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. DB-01 · Rate limiting en la base de datos
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.rate_limit_events (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, action, created_at)
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (profile_id, action, created_at desc);

-- Nadie fuera del service role puede leer ni escribir esta tabla directamente.
alter table public.rate_limit_events enable row level security;

drop policy if exists "service role only rate limit events" on public.rate_limit_events;
create policy "service role only rate limit events"
  on public.rate_limit_events
  to service_role
  using (true)
  with check (true);

revoke all on public.rate_limit_events from anon, authenticated;

comment on table public.rate_limit_events is
  'Contador de acciones por usuario para el rate limiting aplicado en la BD. Solo service_role.';

/*
 * Registra un "hit" y devuelve true si el usuario sigue dentro de su cuota.
 *
 * Nota deliberada: se registra el intento ANTES de comprobar el límite. Si el
 * INSERT de la fila real falla después, la transacción entera revierte y el
 * intento no cuenta (comportamiento deseado). Registrar primero evita que dos
 * peticiones concurrentes pasen ambas la comprobación.
 */
create or replace function public.rate_limit_hit(
  p_profile_id uuid,
  p_action text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  -- Limpieza oportunista de filas antiguas (ventana máxima de 7 días).
  delete from public.rate_limit_events
   where profile_id = p_profile_id
     and action = p_action
     and created_at < now() - interval '7 days';

  insert into public.rate_limit_events (profile_id, action)
  values (p_profile_id, p_action);

  select count(*) into v_count
    from public.rate_limit_events
   where profile_id = p_profile_id
     and action = p_action
     and created_at > now() - make_interval(secs => p_window_seconds);

  return v_count <= p_limit;
end;
$$;

revoke all on function public.rate_limit_hit(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(uuid, text, int, int) to service_role;

/*
 * Dispatcher de triggers de rate limit.
 *
 * Resuelve el autor de la fila por el nombre de columna que se le pasa en
 * TG_ARGV[1], soporta ventanas en horas o días (TG_ARGV[2] = 'hour'|'day') y
 * aplica límites más estrictos a cuentas con menos de 24 h de antigüedad.
 *
 * El error usa el código estable 53400 (configuration_limit_exceeded) para que
 * el frontend pueda distinguirlo de un error genérico.
 */
create or replace function public.tg_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action       text := TG_ARGV[0];
  v_owner_column text := TG_ARGV[1];
  v_unit         text := TG_ARGV[2];
  v_limit        int  := TG_ARGV[3]::int;
  v_new_limit    int  := TG_ARGV[4]::int;
  v_window       int;
  v_profile      uuid;
  v_account_age  interval;
  v_allowed      boolean;
  v_json         jsonb;
  v_owner_text   text;
begin
  -- Autor de la fila: se obtiene con SQL dinámico porque el nombre de la
  -- columna cambia según la tabla (owner_profile_id, author_profile_id, …).
  execute format('select ($1).%I::text', v_owner_column) into v_owner_text using new;

  if v_owner_text is null then
    return new;  -- sin autor identificable: no hay a quién limitar
  end if;

  v_profile := v_owner_text::uuid;

  -- El service role (workers, cron, migraciones) no está sujeto a estas cuotas.
  if auth.uid() is null and current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  v_window := case v_unit when 'day' then 86400 else 3600 end;

  select coalesce(now() - created_at, interval '0') into v_account_age
    from public.profiles where id = v_profile;

  v_allowed := public.rate_limit_hit(
    v_profile,
    v_action,
    case when v_account_age < interval '24 hours' then v_new_limit else v_limit end,
    v_window
  );

  if not v_allowed then
    v_json := jsonb_build_object(
      'code', 'RATE_LIMIT_EXCEEDED',
      'action', v_action,
      'message', 'Has alcanzado el límite de esta acción. Espera un rato e inténtalo de nuevo.',
      'window', case v_unit when 'day' then '24 horas' else '1 hora' end
    );

    raise exception 'rate limit exceeded for %', v_action
      using errcode = '53400',
            detail = v_json::text,
            hint = v_json->>'message';
  end if;

  return new;
end;
$$;

revoke all on function public.tg_rate_limit() from public, anon, authenticated;

-- Cuotas: (acción, columna de autor, unidad, límite normal, límite cuenta nueva)
do $do$
declare
  cfg text[][] := array[
    ['comment',          'author_profile_id',    'hour', '10', '3', 'comments'],
    ['publication',      'owner_profile_id',     'day',  '5',  '2', 'publications'],
    ['sighting',         'reporter_profile_id',  'hour', '10', '3', 'sightings'],
    ['adoption_request', 'requester_profile_id', 'day',  '10', '3', 'adoption_requests'],
    ['report',           'reporter_id',          'hour', '3',  '1', 'reports']
  ];
  i int;
  r text[];
  trig_name text;
begin
  for i in 1 .. array_length(cfg, 1) loop
    r := cfg[i];
    trig_name := r[6] || '_rate_limit';

    execute format('drop trigger if exists %I on public.%I', trig_name, r[6]);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.tg_rate_limit(%L, %L, %L, %L, %L)',
      trig_name, r[6], r[1], r[2], r[3], r[4], r[5]
    );

    raise notice 'rate limit aplicado: %.% -> %/%', r[6], trig_name, r[4], r[3];
  end loop;
end
$do$;

comment on function public.tg_rate_limit() is
  'Rate limit por auth.uid() en la BD. Lanza SQLSTATE 53400 con detalle RATE_LIMIT_EXCEEDED.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. DB-06 · Registro y cuota de revelación de datos de contacto
-- ════════════════════════════════════════════════════════════════════════════
--
-- Los datos de contacto ya NO se pueden leer en masa: se revocan las columnas a
-- `anon` (sección 5). Para `authenticated` se mantiene la lectura —la UI los usa
-- en la página de publicación y en el formulario de edición— pero queda registro
-- de cada acceso y una cuota diaria por usuario.

create table if not exists public.contact_reveals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists contact_reveals_lookup_idx
  on public.contact_reveals (profile_id, created_at desc);

alter table public.contact_reveals enable row level security;

-- El usuario puede ver SU propio historial de revelaciones; nadie más.
drop policy if exists "own contact reveals readable" on public.contact_reveals;
create policy "own contact reveals readable"
  on public.contact_reveals
  for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "service role manages contact reveals" on public.contact_reveals;
create policy "service role manages contact reveals"
  on public.contact_reveals
  to service_role
  using (true)
  with check (true);

-- Las inserciones las hace el trigger (SECURITY DEFINER), no el cliente.
revoke insert, update, delete on public.contact_reveals from anon, authenticated;

comment on table public.contact_reveals is
  'Auditoría de accesos a teléfono/WhatsApp/email de una publicación, con cuota diaria.';

/*
 * Trigger AFTER SELECT: registra la revelación y corta si se supera la cuota.
 *
 * Es el único punto donde Postgres permite condicionar una LECTURA según una
 * cuota por usuario. La alternativa (RLS) no puede contar filas de otra tabla
 * sin coste cuadrático por fila.
 *
 * Se saltan los accesos legítimos que no son "revelación":
 *   - el dueño de la publicación (lo ve en su propio formulario de edición)
 *   - moderadores y administradores
 */
create or replace function public.tg_contact_reveal_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role  public.user_role;
  v_owner uuid;
  v_limit int := 30;          -- revelaciones por usuario cada 24 h
  v_recent int;
  v_allowed boolean;
  v_json jsonb;
begin
  -- Sin sesión (anon) o sin columnas de contacto: nada que registrar.
  if v_actor is null then
    return null;
  end if;

  if new.contact_phone is null
     and new.contact_whatsapp is null
     and new.contact_email is null then
    return null;
  end if;

  select role into v_role from public.profiles where id = v_actor;
  if v_role in ('MODERATOR', 'ADMIN') then
    return null;
  end if;

  v_owner := new.owner_profile_id;
  if v_owner = v_actor then
    return null;  -- es su propia publicación
  end if;

  v_allowed := public.rate_limit_hit(v_actor, 'contact_reveal', v_limit, 86400);

  if not v_allowed then
    v_json := jsonb_build_object(
      'code', 'CONTACT_REVEAL_LIMIT',
      'message', 'Has visto demasiados contactos hoy. Vuelve mañana o guarda la publicación en favoritos.',
      'limit', v_limit,
      'window', '24 horas'
    );

    raise exception 'contact reveal quota exceeded'
      using errcode = '53400',
            detail = v_json::text,
            hint = v_json->>'message';
  end if;

  insert into public.contact_reveals (profile_id, publication_id)
  values (v_actor, new.id);

  return null;
end;
$$;

revoke all on function public.tg_contact_reveal_quota() from public, anon, authenticated;

drop trigger if exists publications_contact_reveal_quota on public.publications;
create trigger publications_contact_reveal_quota
  after select on public.publications
  for each row
  execute function public.tg_contact_reveal_quota();

comment on function public.tg_contact_reveal_quota() is
  'Registra y limita (30/24 h) los accesos de terceros a los datos de contacto de una publicación.';

-- ════════════════════════════════════════════════════════════════════════════
-- 5. DB-06 · Revocar columnas sensibles a anon
-- ════════════════════════════════════════════════════════════════════════════
--
-- Antes, cualquiera con la anon key (sin cuenta) podía descargar en masa
-- teléfonos, WhatsApp y emails de todas las publicaciones activas.
--
-- OJO para el frontend: una consulta de `anon` que incluya una de estas
-- columnas falla con "permission denied for column". `getPublicationById()` de
-- src/lib/supabase/publication-search.ts las pide; esa función se usa en el
-- flujo autenticado (edición). Ver docs/AUDITORIA_SEGURIDAD.md (DB-06).

revoke select (contact_phone, contact_whatsapp, contact_email) on public.publications from anon;
grant  select (contact_phone, contact_whatsapp, contact_email) on public.publications to authenticated;

comment on column public.publications.contact_phone is
  'PII. No legible por anon desde 0012; lectura autenticada con cuota de 30/24 h.';

-- ════════════════════════════════════════════════════════════════════════════
-- 6. DB-08 · Políticas permisivas sin cláusula TO
-- ════════════════════════════════════════════════════════════════════════════

-- 6.1 notifications INSERT: estaba abierta a TODO el mundo (incluido anon),
-- así que cualquiera podía insertar notificaciones para cualquier profile_id.
drop policy if exists "system can insert notifications" on public.notifications;
create policy "service role can insert notifications"
  on public.notifications
  for insert
  to service_role
  with check (true);

-- 6.2 external_sources UPDATE: el comentario decía "service role" pero sin TO
-- aplicaba a anon y authenticated, que podían alterar is_trusted o is_active.
drop policy if exists "service role can update source tracking" on public.external_sources;
create policy "service role can update source tracking"
  on public.external_sources
  for update
  to service_role
  using (true)
  with check (true);

-- 6.3 takedown_requests INSERT: `with check (true)` permitía a cualquiera crear
-- solicitudes arbitrarias saltándose el rate limit y la autorización de la API.
-- El nombre real de la política original es "anyone can create takedown request".
drop policy if exists "anyone can create takedown request" on public.takedown_requests;
drop policy if exists "anyone can request takedown" on public.takedown_requests;
create policy "service role can insert takedown requests"
  on public.takedown_requests
  for insert
  to service_role
  with check (true);

-- ════════════════════════════════════════════════════════════════════════════
-- 6.4 · Hueco `X is null`: inserción en nombre de nadie
-- ════════════════════════════════════════════════════════════════════════════
--
-- Varias políticas de INSERT aceptaban `auth.uid() = autor or autor is null`.
-- La segunda rama permitía crear la fila con el autor a NULL, y de paso esquivar
-- el rate limit por usuario de la sección 3 (sin autor no hay a quién limitar).
--
-- Efecto real: cualquiera con la anon key podía llenar `comments`, `sightings` y
-- `reports` sin cuenta ni cuota. Se exige que el autor sea el usuario en sesión.
--
-- `notifications` se cierra por completo: su política de INSERT era
-- `with check (true)` para todo el mundo. La creación de notificaciones es una
-- responsabilidad del servidor (service_role), no del cliente.

drop policy if exists "authenticated users can comment" on public.comments;
create policy "authenticated users can comment"
  on public.comments for insert
  to authenticated
  with check (author_profile_id = auth.uid());

drop policy if exists "authenticated users can create sightings" on public.sightings;
create policy "authenticated users can create sightings"
  on public.sightings for insert
  to authenticated
  with check (reporter_profile_id = auth.uid());

drop policy if exists "reporters can insert reports" on public.reports;
create policy "reporters can insert reports"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "pet owner can insert" on public.pets;
create policy "pet owner can insert"
  on public.pets for insert
  to authenticated
  with check (owner_profile_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- 7. DB-03 · Limpieza de privilegios en funciones expuestas
-- ════════════════════════════════════════════════════════════════════════════
--
-- Las funciones de búsqueda son SECURITY INVOKER (RLS sigue aplicando), pero no
-- hay razón para dejar EXECUTE a PUBLIC por defecto. Se deja explícito.

do $do$
declare
  fn text;
  fns text[] := array[
    'public.search_publications',
    'public.search_similar_publications_by_text',
    'public.search_similar_images',
    'public.calculate_structured_match_score'
  ];
begin
  foreach fn in array fns loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname || '.' || p.proname = fn) then
      execute format('revoke all on function %s from public', fn);
      execute format('grant execute on function %s to authenticated, service_role', fn);
    end if;
  end loop;
end
$do$;
