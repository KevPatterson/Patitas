-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas pgTAP de la política de UPDATE de publicaciones (migración 0022)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Regresión del error 21000 "more than one row returned by a subquery used as
-- an expression" al eliminar (soft delete), ocultar o resolver una publicación.
-- También comprueba que el dueño sigue sin poder transferir la publicación.
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
  ('a1111111-aaaa-4aaa-8aaa-111111111111', 'policy-owner@example.test', 'x', now(), now() - interval '60 days', now()),
  ('a2222222-bbbb-4bbb-8bbb-222222222222', 'policy-other@example.test', 'x', now(), now() - interval '60 days', now()),
  ('a3333333-cccc-4ccc-8ccc-333333333333', 'policy-mod@example.test', 'x', now(), now() - interval '60 days', now())
on conflict (id) do nothing;

insert into public.profiles (id, username, role)
values
  ('a1111111-aaaa-4aaa-8aaa-111111111111', 'policy-owner', 'USER'),
  ('a2222222-bbbb-4bbb-8bbb-222222222222', 'policy-other', 'USER'),
  ('a3333333-cccc-4ccc-8ccc-333333333333', 'policy-mod', 'MODERATOR')
on conflict (id) do update set username = excluded.username, role = excluded.role;

insert into public.publications (
  id, slug, owner_profile_id, type, status, title, description, species
)
values (
  'a4444444-dddd-4ddd-8ddd-444444444444', 'pgtap-update-policy',
  'a1111111-aaaa-4aaa-8aaa-111111111111', 'LOST', 'ACTIVE',
  'Publicación para probar la política de update',
  'Texto suficientemente largo para pasar las validaciones de la publicación.', 'DOG'
)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. El dueño puede hacer soft delete (antes fallaba con 21000)
-- ────────────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-aaaa-4aaa-8aaa-111111111111","role":"authenticated"}';

select lives_ok(
  $$update public.publications
       set status = 'DELETED', deleted_at = now()
     where id = 'a4444444-dddd-4ddd-8ddd-444444444444'$$,
  'el dueño puede eliminar (soft delete) su publicación sin error 21000'
);

reset role;

select is(
  (select status from public.publications where id = 'a4444444-dddd-4ddd-8ddd-444444444444'),
  'DELETED',
  'la publicación queda en estado DELETED'
);

select ok(
  (select deleted_at from public.publications where id = 'a4444444-dddd-4ddd-8ddd-444444444444') is not null,
  'la publicación queda con deleted_at'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. El dueño sigue sin poder transferir la publicación a otro usuario
-- ────────────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-aaaa-4aaa-8aaa-111111111111","role":"authenticated"}';

select throws_ok(
  $$update public.publications
       set owner_profile_id = 'a2222222-bbbb-4bbb-8bbb-222222222222'
     where id = 'a4444444-dddd-4ddd-8ddd-444444444444'$$,
  '42501',
  null,
  'el dueño no puede cambiar owner_profile_id (protección de la 0005/0012)'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Un moderador sí puede actualizar publicaciones ajenas
-- ────────────────────────────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3333333-cccc-4ccc-8ccc-333333333333","role":"authenticated"}';

select lives_ok(
  $$update public.publications
       set status = 'HIDDEN'
     where id = 'a4444444-dddd-4ddd-8ddd-444444444444'$$,
  'un moderador puede ocultar una publicación ajena'
);

reset role;

select * from finish();

rollback;
