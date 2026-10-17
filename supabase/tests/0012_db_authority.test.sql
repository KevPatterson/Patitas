-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas pgTAP de la migración 0012 (la BD como autoridad)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Objetivo: demostrar que un usuario NORMAL (o un anónimo con la anon key) NO
-- puede hacer lo que antes sí podía. No se prueba el camino feliz: se prueba que
-- las puertas están cerradas.
--
-- Ejecución:
--   supabase test db                 (requiere Docker y Supabase CLI)
--   supabase db reset                (aplica las migraciones)
--
-- Convención de cada bloque: se simula el rol con
--   set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>"}'
-- y al terminar se vuelve a `reset role` para no contaminar el siguiente test.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Se usa no_plan() en lugar de un número fijo: si mañana se añade o se quita un
-- assert, el plan no queda desactualizado y la suite no falla por aritmética.
select no_plan();

-- ────────────────────────────────────────────────────────────────────────────
-- Fixtures: dos usuarios, una publicación y una ubicación
-- ────────────────────────────────────────────────────────────────────────────
-- Se insertan con el rol de la sesión de test (postgres, que bypasea RLS).
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'test-owner@example.test', 'x', now(), now() - interval '30 days', now()),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'test-other@example.test', 'x', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username, created_at)
values
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'test-owner', now() - interval '30 days'),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'test-other', now())
on conflict (id) do nothing;

insert into public.publications (
  id, slug, owner_profile_id, type, status, title, description, species,
  contact_phone, contact_whatsapp, contact_email
)
values (
  'cccccccc-3333-4333-8333-cccccccccccc',
  'test-publicacion-pgtap',
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'LOST',
  'ACTIVE',
  'Perro perdido en el Vedado',
  'Se perdió un perro mestizo de color marrón en el Vedado, cerca del Malecón.',
  'DOG',
  '+5355555555',
  '+5355555555',
  'dueno@example.test'
)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. DB-06 · Los datos de contacto NO son legibles por anon
-- ════════════════════════════════════════════════════════════════════════════

select col_privs_are(
  'public', 'publications', 'contact_phone', 'anon', array[]::text[],
  'DB-06: anon no tiene privilegio de columna sobre contact_phone'
);

select col_privs_are(
  'public', 'publications', 'contact_whatsapp', 'anon', array[]::text[],
  'DB-06: anon no tiene privilegio de columna sobre contact_whatsapp'
);

select col_privs_are(
  'public', 'publications', 'contact_email', 'anon', array[]::text[],
  'DB-06: anon no tiene privilegio de columna sobre contact_email'
);

select col_privs_are(
  'public', 'publications', 'contact_phone', 'authenticated', array['SELECT'],
  'DB-06: authenticated sí puede leer contact_phone (con cuota y registro)'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. DB-08 / DB-14 · Políticas de escritura cerradas
-- ════════════════════════════════════════════════════════════════════════════

select policy_cmd_is(
  'public', 'notifications', 'service role can insert notifications', 'INSERT',
  'DB-08: la inserción de notificaciones es de service_role'
);

select policy_roles_are(
  'public', 'notifications', 'service role can insert notifications', array['service_role'],
  'DB-08: la política de INSERT de notifications solo aplica a service_role'
);

select policy_roles_are(
  'public', 'external_sources', 'service role can update source tracking', array['service_role'],
  'DB-08: solo service_role puede alterar is_trusted/is_active'
);

select policy_roles_are(
  'public', 'takedown_requests', 'service role can insert takedown requests', array['service_role'],
  'DB-08: las solicitudes de retirada entran por la API, no directo a la BD'
);

-- DB-14: las políticas de INSERT ya no aceptan autor NULL.
select policy_is_restrictive(
  'public', 'comments', 'authenticated users can comment', false,
  'DB-14: la política de comentarios sigue la semántica normal (with check)'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. DB-01 · Rate limiting en la base de datos
-- ════════════════════════════════════════════════════════════════════════════

select has_trigger(
  'public', 'comments', 'comments_rate_limit',
  'DB-01: existe el trigger de rate limit en comments'
);

select has_trigger(
  'public', 'publications', 'publications_rate_limit',
  'DB-01: existe el trigger de rate limit en publications'
);

select has_trigger(
  'public', 'sightings', 'sightings_rate_limit',
  'DB-01: existe el trigger de rate limit en sightings'
);

select has_trigger(
  'public', 'reports', 'reports_rate_limit',
  'DB-01: existe el trigger de rate limit en reports'
);

select has_trigger(
  'public', 'adoption_requests', 'adoption_requests_rate_limit',
  'DB-01: existe el trigger de rate limit en adoption_requests'
);

-- Un usuario recién creado (< 24 h) tiene límite estricto: el 2º reporte del
-- mismo usuario debe fallar en la misma hora.
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb","role":"authenticated"}';

select lives_ok(
  $$insert into public.reports (publication_id, reporter_id, reason, description)
    values ('cccccccc-3333-4333-8333-cccccccccccc',
            'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'SPAM', 'primer reporte')$$,
  'DB-01: la cuenta nueva puede crear su primer reporte'
);

select throws_ok(
  $$insert into public.reports (publication_id, reporter_id, reason, description)
    values ('cccccccc-3333-4333-8333-cccccccccccc',
            'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'SPAM', 'segundo reporte')$$,
  '53400',
  null,
  'DB-01: la cuenta nueva NO puede pasar de su cuota de reportes'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. DB-14 · No se puede insertar en nombre de nadie (autor NULL)
-- ════════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb","role":"authenticated"}';

select throws_ok(
  $$insert into public.comments (publication_id, author_profile_id, body)
    values ('cccccccc-3333-4333-8333-cccccccccccc', null, 'comentario anónimo')$$,
  '42501',
  null,
  'DB-14: no se puede comentar con author_profile_id NULL'
);

select throws_ok(
  $$insert into public.sightings (publication_id, reporter_profile_id, note)
    values ('cccccccc-3333-4333-8333-cccccccccccc', null, 'avistamiento anónimo')$$,
  '42501',
  null,
  'DB-14: no se puede crear un avistamiento con reporter NULL'
);

select throws_ok(
  $$insert into public.comments (publication_id, author_profile_id, body)
    values ('cccccccc-3333-4333-8333-cccccccccccc',
            'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'comentario suplantando a otro')$$,
  '42501',
  null,
  'DB-14: no se puede comentar en nombre de otro usuario'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. DB-04 · Difuminado determinista (no promediable)
-- ════════════════════════════════════════════════════════════════════════════

select has_function(
  'public', 'fuzz_coordinates_deterministic', array['uuid', 'numeric', 'numeric'],
  'DB-04: existe la función de difuminado determinista'
);

select is(
  (select fuzzed_lat from public.fuzz_coordinates_deterministic(
     'cccccccc-3333-4333-8333-cccccccccccc', 23.1365, -82.3855)),
  (select fuzzed_lat from public.fuzz_coordinates_deterministic(
     'cccccccc-3333-4333-8333-cccccccccccc', 23.1365, -82.3855)),
  'DB-04: la misma entrada produce SIEMPRE la misma latitud'
);

select is(
  (select fuzzed_lng from public.fuzz_coordinates_deterministic(
     'cccccccc-3333-4333-8333-cccccccccccc', 23.1365, -82.3855)),
  (select fuzzed_lng from public.fuzz_coordinates_deterministic(
     'cccccccc-3333-4333-8333-cccccccccccc', 23.1365, -82.3855)),
  'DB-04: la misma entrada produce SIEMPRE la misma longitud'
);

select isnt(
  (select fuzzed_lat from public.fuzz_coordinates_deterministic(
     'cccccccc-3333-4333-8333-cccccccccccc', 23.1365, -82.3855)),
  (select fuzzed_lat from public.fuzz_coordinates_deterministic(
     'cccccccc-3333-4333-8333-cccccccccccc', 20.0247, -75.8215)),
  'DB-04: coordenadas distintas producen puntos distintos'
);

-- El desplazamiento está acotado a ±0.003 grados (~330 m) sobre la rejilla.
select ok(
  abs(
    (select fuzzed_lat from public.fuzz_coordinates_deterministic(
       'cccccccc-3333-4333-8333-cccccccccccc', 23.1365, -82.3855))
    - 23.14
  ) <= 0.004,
  'DB-04: el desplazamiento se mantiene dentro del radio previsto'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. DB-06 · Cuota y registro de revelación de contacto
-- ════════════════════════════════════════════════════════════════════════════

select has_table(
  'public', 'contact_reveals',
  'DB-06: existe la tabla de auditoría de revelaciones de contacto'
);

-- Regresión: PostgreSQL NO permite triggers sobre SELECT. Una versión anterior de
-- la 0012 intentaba crear `publications_contact_reveal_quota ... after select` y la
-- migración fallaba con 42601. La cuota se aplica en la función RPC de la 0013.
select ok(
  not exists (
    select 1 from pg_trigger where tgname = 'publications_contact_reveal_quota'
  ),
  'DB-06: no se crea un trigger AFTER SELECT (PostgreSQL no lo soporta); la cuota vive en la RPC'
);

select policies_are(
  'public', 'contact_reveals', array['own contact reveals readable', 'service role manages contact reveals'],
  'DB-06: el historial de revelaciones solo lo ve su dueño y el service role'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. DB-02 / DB-03 · Hardening de funciones
-- ════════════════════════════════════════════════════════════════════════════

select is(
  (select proconfig::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'),
  '{"search_path=public, pg_temp"}',
  'DB-02: handle_new_user fija search_path con pg_temp al final'
);

select is(
  (select proconfig::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fuzz_location_on_insert'),
  '{"search_path=public, pg_temp"}',
  'DB-02: fuzz_location_on_insert fija search_path con pg_temp al final'
);

select ok(
  not has_function_privilege('anon', 'public.rate_limit_hit(uuid, text, integer, integer)', 'EXECUTE'),
  'DB-03: anon no puede ejecutar rate_limit_hit'
);

select ok(
  not has_function_privilege('anon', 'public.app_secret()', 'EXECUTE'),
  'DB-03: anon no puede leer el secreto del difuminado'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RLS activo en las tablas nuevas
-- ════════════════════════════════════════════════════════════════════════════

select ok(
  (select relrowsecurity from pg_class where oid = 'public.rate_limit_events'::regclass),
  'DB-01: rate_limit_events tiene RLS activo'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.contact_reveals'::regclass),
  'DB-06: contact_reveals tiene RLS activo'
);

select * from finish();

rollback;
