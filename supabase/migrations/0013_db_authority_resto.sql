-- ════════════════════════════════════════════════════════════════════════════
-- Migración 0013 — Cierre de la Fase 2 (resto de la autoridad en la BD)
-- ════════════════════════════════════════════════════════════════════════════
--
-- La 0012 cubrió el rate limiting en BD, el difuminado determinista, la
-- auditoría de revelaciones de contacto y las políticas demasiado permisivas.
-- Quedaban cuatro huecos, todos verificables solo en la base de datos:
--
--   DB-06  El contacto se podía leer con un simple SELECT (con cuota, sí, pero
--          sin pasar por ningún punto controlado). Ahora solo se obtiene por la
--          función reveal_publication_contact().
--   DB-05  Cualquier usuario autenticado podía hacer UPDATE de CUALQUIER fila de
--          locations. Ahora solo el dueño de una publicación que apunte a esa
--          ubicación.
--   DB-11  Los buckets son públicos (correcto para compartir enlaces), pero las
--          políticas de SELECT permitían LISTAR todos los objetos. Las URLs
--          públicas no pasan por RLS, así que se restringe el listado sin
--          romper las imágenes.
--   DB-07  microchip_private sin grant explícito por columna.
--
-- Además, 2.3: se fija `search_path` en TODAS las funciones de `public` que no
-- lo tenían, sin necesidad de redefinirlas.
--
-- Todo es idempotente.
--
-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────────────
--   drop function if exists public.reveal_publication_contact(uuid);
--   grant select (contact_phone, contact_whatsapp, contact_email)
--     on public.publications to anon, authenticated;
--   drop policy if exists "owners can update own locations" on public.locations;
--   create policy "authenticated users can update locations" on public.locations
--     for update using (auth.uid() is not null) with check (auth.uid() is not null);
--   create policy "pet-images public read" on storage.objects
--     for select using (bucket_id = 'pet-images');
--   drop policy if exists "avatars readable by owner" on storage.objects;
--   create policy "avatars public read" on storage.objects
--     for select using (bucket_id = 'avatars');
--   update storage.buckets set allowed_mime_types = array['image/jpeg','image/jpg','image/png','image/webp','image/gif']
--     where id = 'pet-images';
--   -- El trigger de cuota de la 0012 se puede restaurar reaplicando esa migración.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. DB-06 · El contacto solo se obtiene por una función controlada
-- ════════════════════════════════════════════════════════════════════════════

-- La cuota vivía en un trigger AFTER SELECT de la 0012. Se retira porque ahora
-- la lógica (autorización + cuota + registro) está dentro de la función: si se
-- mantuvieran las dos, cada revelación contaría dos veces.
drop trigger if exists publications_contact_reveal_quota on public.publications;
drop function if exists public.tg_contact_reveal_quota();

/*
 * Devuelve los datos de contacto de una publicación aplicando autorización,
 * cuota diaria y registro.
 *
 * Reglas:
 *   - sin sesión            -> error 42501
 *   - dueño o moderador     -> devuelve siempre, sin consumir cuota y sin
 *                              registrar (es su propia información)
 *   - publicación no visible-> error 42501 (no se filtra la existencia)
 *   - resto                 -> 30 revelaciones cada 24 h; al superarlas, error
 *                              53400 con code CONTACT_REVEAL_LIMIT
 *
 * Es SECURITY DEFINER porque las columnas de contacto ya no tienen SELECT para
 * `authenticated`: la función es el único camino, y aquí se aplica la política.
 */
create or replace function public.reveal_publication_contact(p_publication_id uuid)
returns table(
  contact_phone text,
  contact_whatsapp text,
  contact_email text,
  contact_mode text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := auth.uid();
  v_role    public.user_role;
  v_pub     record;
  v_allowed boolean;
  v_json    jsonb;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = '42501',
            hint = 'Inicia sesión para ver los datos de contacto.';
  end if;

  select p.id, p.owner_profile_id, p.status, p.deleted_at,
         p.contact_phone, p.contact_whatsapp, p.contact_email, p.contact_mode
    into v_pub
    from public.publications p
   where p.id = p_publication_id;

  if not found or v_pub.deleted_at is not null then
    raise exception 'publication not available'
      using errcode = '42501',
            hint = 'La publicación no está disponible.';
  end if;

  select pr.role into v_role from public.profiles pr where pr.id = v_actor;
  v_role := coalesce(v_role, 'USER');

  -- Dueño y moderación: acceso directo, es su trabajo o su propio dato.
  if v_pub.owner_profile_id = v_actor or v_role in ('MODERATOR', 'ADMIN') then
    return query
      select v_pub.contact_phone, v_pub.contact_whatsapp,
             v_pub.contact_email, v_pub.contact_mode;
    return;
  end if;

  if v_pub.status not in ('ACTIVE', 'RESOLVED') then
    raise exception 'publication not available'
      using errcode = '42501',
            hint = 'La publicación no está disponible.';
  end if;

  v_allowed := public.rate_limit_hit(v_actor, 'contact_reveal', 30, 86400);

  if not v_allowed then
    v_json := jsonb_build_object(
      'code', 'CONTACT_REVEAL_LIMIT',
      'message', 'Has visto demasiados contactos hoy. Vuelve mañana.',
      'limit', 30,
      'window', '24 horas'
    );

    raise exception 'contact reveal quota exceeded'
      using errcode = '53400',
            detail = v_json::text,
            hint = v_json->>'message';
  end if;

  insert into public.contact_reveals (profile_id, publication_id)
  values (v_actor, p_publication_id);

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'CONTACT_REVEALED', 'publication', p_publication_id, jsonb_build_object('via', 'rpc'));

  return query
    select v_pub.contact_phone, v_pub.contact_whatsapp,
           v_pub.contact_email, v_pub.contact_mode;
end;
$$;

comment on function public.reveal_publication_contact(uuid) is
  'Único camino para leer los datos de contacto: autoriza, aplica cuota de 30/24 h y registra la revelación.';

revoke all on function public.reveal_publication_contact(uuid) from public, anon;
grant execute on function public.reveal_publication_contact(uuid) to authenticated, service_role;

-- Ahora nadie (salvo el service role) puede leer las columnas directamente.
revoke select (contact_phone, contact_whatsapp, contact_email) on public.publications from authenticated;

comment on column public.publications.contact_phone is
  'PII. Sin SELECT para anon ni authenticated desde 0013: se obtiene con reveal_publication_contact().';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. DB-05 · Solo el dueño puede editar su ubicación
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "authenticated users can update locations" on public.locations;

drop policy if exists "owners can update own locations" on public.locations;
create policy "owners can update own locations"
  on public.locations
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.publications p
       where p.location_id = locations.id
         and p.owner_profile_id = auth.uid()
         and p.deleted_at is null
    )
    or exists (
      select 1 from public.profiles pr
       where pr.id = auth.uid() and pr.role in ('MODERATOR', 'ADMIN')
    )
  )
  with check (
    exists (
      select 1
        from public.publications p
       where p.location_id = locations.id
         and p.owner_profile_id = auth.uid()
         and p.deleted_at is null
    )
    or exists (
      select 1 from public.profiles pr
       where pr.id = auth.uid() and pr.role in ('MODERATOR', 'ADMIN')
    )
  );

comment on policy "owners can update own locations" on public.locations is
  'Antes cualquier autenticado podía editar cualquier fila; ahora solo el dueño de una publicación que apunte a esa ubicación.';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. DB-11 · El listado de Storage deja de ser anónimo
-- ════════════════════════════════════════════════════════════════════════════
--
-- IMPORTANTE: esto NO afecta a las imágenes. Las URLs públicas
-- (`/storage/v1/object/public/...`) se sirven sin pasar por RLS. Lo que se cierra
-- es la API de listado, que permitía enumerar todos los archivos del bucket.

drop policy if exists "pet-images public read" on storage.objects;

-- Avatares: el cliente hace `.list(userId)`, así que se permite listar solo la
-- carpeta propia.
drop policy if exists "avatars public read" on storage.objects;

drop policy if exists "avatars readable by owner" on storage.objects;
create policy "avatars readable by owner"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Coherencia con la Fase 3: el bucket solo acepta los formatos que la validación
-- por magic bytes considera válidos. Se elimina GIF.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
 where id = 'pet-images';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. DB-07 · Defensa en profundidad por columna
-- ════════════════════════════════════════════════════════════════════════════
--
-- `pets.microchip_private` ya está protegida por la política de fila, pero se
-- revoca también a nivel de columna: si algún día alguien añade una política de
-- lectura más amplia, el dato sigue sin salir.

revoke select (microchip_private) on public.pets from anon, authenticated;

comment on column public.pets.microchip_private is
  'Dato sensible. Sin SELECT para anon ni authenticated: solo el service role lo lee.';

-- ════════════════════════════════════════════════════════════════════════════
-- 5. 2.3 · search_path fijo en TODAS las funciones de public
-- ════════════════════════════════════════════════════════════════════════════
--
-- `ALTER FUNCTION ... SET search_path` no obliga a redefinir el cuerpo, así que
-- se puede aplicar a las funciones existentes sin riesgo de romper su lógica.
-- Se aplica a todas: las que ya lo tenían quedan igual y las que no, protegidas.

do $do$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
          where c like 'search_path=%'
       )
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.fn);
    raise notice 'search_path fijado en %', r.fn;
  end loop;
end
$do$;

-- Las funciones de búsqueda son SECURITY INVOKER (RLS aplica), pero no hay razón
-- para dejar EXECUTE a PUBLIC. Se deja explícito a los roles que las usan.
--
-- IMPORTANTE: las firmas son las REALES del esquema (se comprobaron contra
-- 0008_search_optimization.sql y 0010_matching_system.sql). Una versión anterior
-- de este bloque tenía firmas inventadas:
--
--   search_publications:                       9 args  →  en realidad tiene 11
--   search_similar_publications_by_text(text…): text    →  en realidad vector
--
-- y el `exception when undefined_function` las omitía en silencio, de modo que el
-- REVOKE nunca se aplicaba. Ahora las firmas son exactas y, si algo no se
-- encuentra, se emite un WARNING (visible en la salida de la migración) en lugar
-- de un NOTICE fácil de perder.
do $do$
declare
  fn text;
  fns text[] := array[
    'public.search_publications(text, public.publication_type, text, text, text, public.publication_status, text, text, date, integer, integer)',
    'public.calculate_structured_match_score(uuid, uuid)',
    'public.search_similar_publications_by_text(public.vector, real, integer)',
    'public.search_similar_images(public.vector, real, integer)'
  ];
begin
  foreach fn in array fns loop
    begin
      execute format('revoke all on function %s from public, anon', fn);
      execute format('grant execute on function %s to authenticated, service_role', fn);
    exception
      when undefined_function or undefined_object then
        raise warning 'no se pudo ajustar privilegios de % (¿pgvector sin instalar?)', fn;
    end;
  end loop;
end
$do$;
