-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas pgTAP de RLS e IDOR (Fase 2, tarea 2.7)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Criterio de aceptación: "un intento directo con supabase-js saltándose /api
-- queda limitado igual".
--
-- Esto es exactamente lo que se comprueba aquí: se simula el rol `authenticated`
-- con el JWT de un usuario concreto (que es lo que hace supabase-js al enviar la
-- anon key + el token de sesión) y se intenta, sin pasar por ninguna función de
-- /api:
--
--   - leer, editar y borrar publicaciones ajenas
--   - escalar el propio rol a ADMIN
--   - leer las coordenadas exactas / el secreto del difuminado
--   - leer notificaciones ajenas
--   - insertar filas en nombre de otro usuario
--   - revelar datos de contacto saltándose la cuota
--   - editar una ubicación ajena
--   - listar objetos de Storage
--
-- Ejecución: supabase test db   (requiere Docker)
-- ════════════════════════════════════════════════════════════════════════════

begin;

select no_plan();

-- ────────────────────────────────────────────────────────────────────────────
-- Fixtures
-- ────────────────────────────────────────────────────────────────────────────
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-aaaa-4aaa-8aaa-111111111111', 'owner@example.test', 'x', now(), now() - interval '60 days', now()),
  ('22222222-bbbb-4bbb-8bbb-222222222222', 'other@example.test', 'x', now(), now() - interval '60 days', now()),
  ('33333333-cccc-4ccc-8ccc-333333333333', 'mod@example.test', 'x', now(), now() - interval '60 days', now())
on conflict (id) do nothing;

insert into public.profiles (id, username, role)
values
  ('11111111-aaaa-4aaa-8aaa-111111111111', 'owner-test', 'USER'),
  ('22222222-bbbb-4bbb-8bbb-222222222222', 'other-test', 'USER'),
  ('33333333-cccc-4ccc-8ccc-333333333333', 'mod-test', 'MODERATOR')
on conflict (id) do update set role = excluded.role;

insert into public.locations (id, province, municipality, zone, approximate_lat, approximate_lng)
values
  ('44444444-dddd-4ddd-8ddd-444444444444', 'La Habana', 'Plaza', 'Vedado', 23.1365, -82.3855)
on conflict (id) do nothing;

insert into public.publications (
  id, slug, owner_profile_id, location_id, type, status, title, description, species,
  contact_phone, contact_whatsapp
)
values
  ('55555555-eeee-4eee-8eee-555555555555', 'pgtap-activa',
   '11111111-aaaa-4aaa-8aaa-111111111111', '44444444-dddd-4ddd-8ddd-444444444444',
   'LOST', 'ACTIVE', 'Perro perdido en Vedado',
   'Perro mestizo marrón perdido en el Vedado, zona del Malecón.', 'DOG',
   '+5355555555', '+5355555555'),
  ('66666666-ffff-4fff-8fff-666666666666', 'pgtap-oculta',
   '11111111-aaaa-4aaa-8aaa-111111111111', null,
   'LOST', 'HIDDEN', 'Publicación oculta del owner',
   'Esta publicación está oculta por moderación y no debe verse.', 'CAT',
   '+5355555556', null)
on conflict (id) do nothing;

insert into public.notifications (id, profile_id, type, title, body)
values (
  '77777777-aaaa-4aaa-8aaa-777777777777',
  '11111111-aaaa-4aaa-8aaa-111111111111',
  'SYSTEM', 'Notificación privada del owner', 'Solo el owner debe verla'
)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Aislamiento entre usuarios: el usuario B no ve ni toca lo de A
-- ════════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-bbbb-4bbb-8bbb-222222222222","role":"authenticated"}';

-- 1.1 Lectura de una publicación ajena oculta: 0 filas.
select is(
  (select count(*) from public.publications where id = '66666666-ffff-4fff-8fff-666666666666'),
  0::bigint,
  'IDOR: un usuario no ve las publicaciones ocultas de otro'
);

-- 1.2 Lectura de una publicación ajena activa: sí se ve (es pública), pero...
select is(
  (select count(*) from public.publications where id = '55555555-eeee-4eee-8eee-555555555555'),
  1::bigint,
  'las publicaciones ACTIVE ajenas sí son visibles (son públicas)'
);

-- 1.3 ...no puede modificarla.
select throws_ok(
  $$update public.publications set title = 'secuestrada'
     where id = '55555555-eeee-4eee-8eee-555555555555'$$,
  '42501',
  null,
  'IDOR: un usuario no puede editar la publicación de otro'
);

-- 1.4 Ni borrarla.
select is(
  (with del as (
     delete from public.publications
      where id = '55555555-eeee-4eee-8eee-555555555555'
      returning 1
   )
   select count(*) from del),
  0::bigint,
  'IDOR: un usuario no puede borrar la publicación de otro'
);

-- 1.5 Ni insertar una publicación a nombre de otro.
select throws_ok(
  $$insert into public.publications (slug, owner_profile_id, type, title, description, species)
    values ('pgtap-suplantacion', '11111111-aaaa-4aaa-8aaa-111111111111',
            'LOST', 'Publicación suplantando a otro', 'Texto suficientemente largo.', 'DOG')$$,
  '42501',
  null,
  'IDOR: no se puede crear una publicación a nombre de otro usuario'
);

-- 1.6 Ni insertar una solicitud de adopción a nombre de otro.
select throws_ok(
  $$insert into public.adoption_requests (publication_id, requester_profile_id, message)
    values ('55555555-eeee-4eee-8eee-555555555555',
            '11111111-aaaa-4aaa-8aaa-111111111111', 'solicitud suplantada')$$,
  '42501',
  null,
  'IDOR: no se puede crear una solicitud de adopción en nombre de otro'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Notificaciones ajenas
-- ════════════════════════════════════════════════════════════════════════════

select is(
  (select count(*) from public.notifications
    where id = '77777777-aaaa-4aaa-8aaa-777777777777'),
  0::bigint,
  'notificaciones: un usuario no puede leer las de otro'
);

select is(
  (with upd as (
     update public.notifications set is_read = true
      where id = '77777777-aaaa-4aaa-8aaa-777777777777'
      returning 1
   )
   select count(*) from upd),
  0::bigint,
  'notificaciones: un usuario no puede marcar como leídas las de otro'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Escalada de rol
-- ════════════════════════════════════════════════════════════════════════════

select throws_ok(
  $$update public.profiles set role = 'ADMIN'
     where id = '22222222-bbbb-4bbb-8bbb-222222222222'$$,
  '42501',
  null,
  'escalada: un usuario no puede convertirse en ADMIN'
);

select throws_ok(
  $$update public.profiles set role = 'MODERATOR'
     where id = '22222222-bbbb-4bbb-8bbb-222222222222'$$,
  '42501',
  null,
  'escalada: un usuario no puede convertirse en MODERATOR'
);

-- Un cambio de perfil normal (sin tocar el rol) sí debe funcionar.
select lives_ok(
  $$update public.profiles set full_name = 'Nombre normal'
     where id = '22222222-bbbb-4bbb-8bbb-222222222222'$$,
  'un usuario sí puede editar su propio perfil sin tocar el rol'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Coordenadas exactas y secreto del difuminado
-- ════════════════════════════════════════════════════════════════════════════
-- No existen columnas exact_lat/exact_lng: lo que hay que garantizar es que el
-- usuario no puede ni leer el secreto ni obtener el punto original guardando de
-- nuevo la misma ubicación.

select throws_ok(
  $$select public.app_secret()$$,
  '42501',
  null,
  'ubicación: un usuario no puede leer el secreto del difuminado'
);

-- La función de difuminado se revocó a `authenticated` en la 0013 (solo la usan
-- los triggers SECURITY DEFINER), así que aquí se comprueba el permiso…
select throws_ok(
  $$select fuzzed_lat from public.fuzz_coordinates_deterministic(
      '44444444-dddd-4ddd-8ddd-444444444444', 23.1365, -82.3855)$$,
  '42501',
  null,
  'ubicación: un usuario no puede invocar el difuminado directamente'
);

-- …y la propiedad de determinismo se comprueba como rol con permiso (postgres).
reset role;

select is(
  (select fuzzed_lat from public.fuzz_coordinates_deterministic(
     '44444444-dddd-4ddd-8ddd-444444444444', 23.1365, -82.3855)),
  (select fuzzed_lat from public.fuzz_coordinates_deterministic(
     '44444444-dddd-4ddd-8ddd-444444444444', 23.1365, -82.3855)),
  'ubicación: repetir el guardado no genera una muestra nueva (no promediable)'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-bbbb-4bbb-8bbb-222222222222","role":"authenticated"}';

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Datos de contacto (DB-06 cerrado del todo en 0014)
-- ════════════════════════════════════════════════════════════════════════════

select throws_ok(
  $$select contact_phone from public.publications
     where id = '55555555-eeee-4eee-8eee-555555555555'$$,
  '42501',
  null,
  'contacto: un usuario autenticado ya no puede leer la columna directamente'
);

select lives_ok(
  $$select * from public.reveal_publication_contact('55555555-eeee-4eee-8eee-555555555555')$$,
  'contacto: el tercero sí puede revelarlo por la función autorizada'
);

select is(
  (select count(*) from public.contact_reveals
    where profile_id = '22222222-bbbb-4bbb-8bbb-222222222222'),
  1::bigint,
  'contacto: la revelación queda registrada en contact_reveals'
);

reset role;

-- El dueño no consume cuota ni genera registro al ver su propio contacto.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-aaaa-4aaa-8aaa-111111111111","role":"authenticated"}';

select lives_ok(
  $$select * from public.reveal_publication_contact('55555555-eeee-4eee-8eee-555555555555')$$,
  'contacto: el dueño ve su propio contacto'
);

select is(
  (select count(*) from public.contact_reveals
    where profile_id = '11111111-aaaa-4aaa-8aaa-111111111111'),
  0::bigint,
  'contacto: ver el contacto propio no cuenta como revelación'
);

reset role;

-- Sin sesión no hay contacto.
set local role anon;

select throws_ok(
  $$select * from public.reveal_publication_contact('55555555-eeee-4eee-8eee-555555555555')$$,
  '42501',
  null,
  'contacto: un anónimo no puede revelar el contacto'
);

select throws_ok(
  $$select contact_phone from public.publications
     where id = '55555555-eeee-4eee-8eee-555555555555'$$,
  '42501',
  null,
  'contacto: un anónimo no puede leer la columna de contacto'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Ubicaciones (DB-05)
-- ════════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-bbbb-4bbb-8bbb-222222222222","role":"authenticated"}';

select is(
  (with upd as (
     update public.locations
        set approximate_lat = 20.0, approximate_lng = -75.0
      where id = '44444444-dddd-4ddd-8ddd-444444444444'
      returning 1
   )
   select count(*) from upd),
  0::bigint,
  'ubicaciones: un usuario no puede editar la ubicación de la publicación de otro'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-aaaa-4aaa-8aaa-111111111111","role":"authenticated"}';

select lives_ok(
  $$update public.locations
       set approximate_lat = 23.14, approximate_lng = -82.39
     where id = '44444444-dddd-4ddd-8ddd-444444444444'$$,
  'ubicaciones: el dueño sí puede editar la ubicación de su publicación'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Storage: el listado deja de ser anónimo
-- ════════════════════════════════════════════════════════════════════════════

select is(
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'pet-images public read'),
  0::bigint,
  'storage: se eliminó la política de lectura pública de pet-images'
);

select is(
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars public read'),
  0::bigint,
  'storage: se eliminó la política de lectura pública de avatars'
);

select policy_roles_are(
  'storage', 'objects', 'avatars readable by owner', array['authenticated'],
  'storage: los avatares solo se listan por su dueño'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'pet-images'),
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  'storage: el bucket ya no acepta GIF (coherente con la validación por magic bytes)'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Tarea 2.3 · Funciones endurecidas
-- ════════════════════════════════════════════════════════════════════════════

-- Ninguna función de búsqueda devuelve columnas sensibles (contacto o microchip):
-- eso anularía el REVOKE por columna, porque una función las devolvería igual.
select ok(
  (
    select not coalesce(
      bool_or(pg_get_function_result(p.oid) ilike '%contact_%')
      or bool_or(pg_get_function_result(p.oid) ilike '%microchip%'),
      false
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.proname in (
         'search_publications',
         'search_similar_publications_by_text',
         'search_similar_images',
         'calculate_structured_match_score'
       )
  ),
  '2.3: ninguna función de búsqueda devuelve contacto ni microchip'
);

-- Todas las funciones de `public` fijan search_path: un search_path mutable en
-- una SECURITY DEFINER permite secuestrar objetos con un esquema temporal.
select is(
  (
    select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
          where c like 'search_path=%'
       )
  ),
  0::bigint,
  '2.3: todas las funciones de public fijan search_path'
);

select ok(
  not has_function_privilege('anon', 'public.reveal_publication_contact(uuid)', 'EXECUTE'),
  '2.3: anon no puede ejecutar reveal_publication_contact'
);

select ok(
  has_function_privilege('authenticated', 'public.reveal_publication_contact(uuid)', 'EXECUTE'),
  '2.3: authenticated sí puede ejecutar reveal_publication_contact'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Moderador: sí puede hacer lo que un usuario normal no
-- ════════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-cccc-4ccc-8ccc-333333333333","role":"authenticated"}';

select is(
  (select count(*) from public.publications where id = '66666666-ffff-4fff-8fff-666666666666'),
  1::bigint,
  'moderación: el moderador sí ve las publicaciones ocultas'
);

select lives_ok(
  $$update public.publications set status = 'ACTIVE'
     where id = '66666666-ffff-4fff-8fff-666666666666'$$,
  'moderación: el moderador sí puede restaurar una publicación oculta'
);

reset role;

select * from finish();

rollback;
