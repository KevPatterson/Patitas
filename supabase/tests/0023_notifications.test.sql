-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas pgTAP del sistema de notificaciones (migración 0023)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Regresión: sin política RLS de DELETE, `delete().eq('id', ...)` desde
-- supabase-js devolvía 0 filas SIN error y la notificación reaparecía al
-- recargar. También se comprueba que la tabla está en supabase_realtime y que
-- REPLICA IDENTITY FULL permite filtrar los DELETE por profile_id.
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
  ('b1111111-aaaa-4aaa-8aaa-111111111111', 'notif-owner@example.test', 'x', now(), now() - interval '60 days', now()),
  ('b2222222-bbbb-4bbb-8bbb-222222222222', 'notif-other@example.test', 'x', now(), now() - interval '60 days', now())
on conflict (id) do nothing;

insert into public.profiles (id, username, role)
values
  ('b1111111-aaaa-4aaa-8aaa-111111111111', 'notif-owner', 'USER'),
  ('b2222222-bbbb-4bbb-8bbb-222222222222', 'notif-other', 'USER')
on conflict (id) do update set username = excluded.username, role = excluded.role;

insert into public.notifications (id, profile_id, type, title, body)
values
  ('b3333333-cccc-4ccc-8ccc-333333333333',
   'b1111111-aaaa-4aaa-8aaa-111111111111',
   'SYSTEM', 'Aviso del owner', 'Solo el owner puede borrarlo'),
  ('b4444444-dddd-4ddd-8ddd-444444444444',
   'b2222222-bbbb-4bbb-8bbb-222222222222',
   'SYSTEM', 'Aviso del otro', 'Solo el otro puede borrarlo')
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Metadatos: política, Realtime y REPLICA IDENTITY
-- ────────────────────────────────────────────────────────────────────────────
select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'notifications'
       and policyname = 'profile owner can delete notifications'
       and cmd = 'DELETE'
  ),
  'notificaciones: existe la política RLS de DELETE'
);

select ok(
  exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ),
  'notificaciones: la tabla está publicada en supabase_realtime'
);

select is(
  (
    select c.relreplident::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'notifications'
  ),
  'f',
  'notificaciones: REPLICA IDENTITY FULL para poder filtrar DELETE'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Un usuario no puede borrar la notificación de otro
-- ────────────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"b2222222-bbbb-4bbb-8bbb-222222222222","role":"authenticated"}';

select is(
  (
    with del as (
      delete from public.notifications
       where id = 'b3333333-cccc-4ccc-8ccc-333333333333'
       returning 1
    )
    select count(*) from del
  ),
  0::bigint,
  'notificaciones: un usuario no puede borrar las de otro'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. El dueño sí puede borrar la suya
-- ────────────────────────────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1111111-aaaa-4aaa-8aaa-111111111111","role":"authenticated"}';

select is(
  (select count(*) from public.notifications
    where id = 'b3333333-cccc-4ccc-8ccc-333333333333'),
  1::bigint,
  'notificaciones: el intento fallido del otro no borró la notificación del owner'
);

select is(
  (
    with del as (
      delete from public.notifications
       where id = 'b3333333-cccc-4ccc-8ccc-333333333333'
       returning 1
    )
    select count(*) from del
  ),
  1::bigint,
  'notificaciones: el dueño puede borrar su propia notificación'
);

select is(
  (select count(*) from public.notifications
    where id = 'b3333333-cccc-4ccc-8ccc-333333333333'),
  0::bigint,
  'notificaciones: la notificación borrada ya no existe'
);

reset role;

select * from finish();

rollback;
