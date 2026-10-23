-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas pgTAP del chat interno (migración 0019)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Comprueba, sin pasar por la UI:
--   - que solo se puede abrir un hilo con el dueño de una publicación ACTIVE,
--   - que el hilo es único por publicación e interesado,
--   - que un tercero no lee ni escribe,
--   - que el bloqueo corta el envío en ambos sentidos,
--   - que resolver la publicación archiva en solo lectura,
--   - que la notificación es una por hilo y no una por mensaje,
--   - que moderación solo lee el contexto de un reporte y queda auditoría,
--   - que compartir contacto requiere consentimiento del dueño,
--   - que la retención solo la puede ejecutar service_role.
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
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'chat-owner@example.test', 'x', now(), now() - interval '60 days', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'chat-requester@example.test', 'x', now(), now() - interval '60 days', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'chat-stranger@example.test', 'x', now(), now() - interval '60 days', now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'chat-mod@example.test', 'x', now(), now() - interval '60 days', now())
on conflict (id) do nothing;

insert into public.profiles (id, username, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'chat-owner', 'USER'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'chat-requester', 'USER'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'chat-stranger', 'USER'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'chat-mod', 'MODERATOR')
on conflict (id) do update set username = excluded.username, role = excluded.role;

insert into public.publications (
  id, slug, owner_profile_id, type, status, title, description, species,
  contact_phone, contact_whatsapp
)
values
  ('e1111111-1111-4111-8111-111111111111', 'chat-perro-perdido',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'LOST', 'ACTIVE',
   'Firulais perdido en el Vedado',
   'Perro mestizo marrón visto por última vez cerca del Malecón.',
   'DOG', '+5355555555', '+5355555555'),
  ('e2222222-2222-4222-8222-222222222222', 'chat-gato-adopcion',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ADOPTION', 'ACTIVE',
   'Michi en adopción',
   'Gato joven esterilizado que busca familia responsable.',
   'CAT', '+5355555555', null)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Apertura del hilo
-- ────────────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select throws_ok(
  $$select public.start_conversation('e1111111-1111-4111-8111-111111111111')$$,
  '23514',
  null,
  'el dueño no puede abrir un chat consigo mismo'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select ok(
  (select public.start_conversation('e1111111-1111-4111-8111-111111111111')) is not null,
  'el interesado abre un hilo con el dueño'
);

select is(
  (select public.start_conversation('e1111111-1111-4111-8111-111111111111')),
  (select c.id from public.conversations c
    where c.publication_id = 'e1111111-1111-4111-8111-111111111111'
      and c.requester_profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'reabrir devuelve el mismo hilo, no crea otro'
);

set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select ok(
  (select public.start_conversation('e1111111-1111-4111-8111-111111111111')) is not null,
  'otro interesado puede abrir su propio hilo en la misma publicación'
);

-- Guardamos los ids en una tabla temporal accesible desde los tres roles,
-- porque un usuario no debe poder ver el hilo ajeno ni para conocer su id.
reset role;

create temp table chat_test_ids on commit drop as
select
  (select c.id from public.conversations c
    where c.publication_id = 'e1111111-1111-4111-8111-111111111111'
      and c.requester_profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') as requester_conv,
  (select c.id from public.conversations c
    where c.publication_id = 'e1111111-1111-4111-8111-111111111111'
      and c.requester_profile_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') as stranger_conv;

grant select on chat_test_ids to authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Envío e idempotencia
-- ────────────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select lives_ok(
  $$select public.send_message(
      (select requester_conv from chat_test_ids),
      'Hola, vi a tu perro cerca del Malecón. ¿Sigue perdido?',
      'f1111111-1111-4111-8111-111111111111'
    )$$,
  'el interesado envía el primer mensaje'
);

select is(
  (select id from public.send_message(
      (select requester_conv from chat_test_ids),
      'Hola, vi a tu perro cerca del Malecón. ¿Sigue perdido?',
      'f1111111-1111-4111-8111-111111111111'
    )),
  (select id from public.send_message(
      (select requester_conv from chat_test_ids),
      'Hola, vi a tu perro cerca del Malecón. ¿Sigue perdido?',
      'f1111111-1111-4111-8111-111111111111'
    )),
  'reintentar con el mismo client_message_id no duplica'
);

select is(
  (select count(*) from public.messages
    where conversation_id = (select requester_conv from chat_test_ids)),
  1::bigint,
  'solo existe un mensaje tras el reintento'
);

select throws_ok(
  $$select public.send_message(
      (select requester_conv from chat_test_ids),
      repeat('a', 2001),
      'f7777777-7777-4777-8777-777777777777'
    )$$,
  '23514',
  null,
  'un mensaje de más de 2000 caracteres se rechaza'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Notificación agrupada y contador de no leídos
-- ────────────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select public.unread_chat_count()),
  1::bigint,
  'el dueño tiene un mensaje sin leer'
);

select is(
  (select g.unread_count from public.get_conversations() g
    where g.conversation_id = (select requester_conv from chat_test_ids)),
  1::bigint,
  'la bandeja muestra el no leído del hilo'
);

select is(
  (select count(*) from public.notifications
    where type = 'MESSAGE' and is_read = false),
  1::bigint,
  'una sola notificación MESSAGE sin leer por hilo'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Aislamiento: el tercero no ve ni escribe
-- ────────────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select is(
  (select count(*) from public.conversations),
  1::bigint,
  'el tercero solo ve su propio hilo'
);

select is(
  (select count(*) from public.messages
    where conversation_id = (select requester_conv from chat_test_ids)),
  0::bigint,
  'el tercero no lee los mensajes del hilo ajeno'
);

select is(
  (select count(*) from public.conversations
    where id = (select requester_conv from chat_test_ids)),
  0::bigint,
  'el tercero no ve ni la fila de la conversación ajena'
);

select throws_ok(
  $$select public.send_message(
      (select requester_conv from chat_test_ids),
      'intruso',
      'f2222222-2222-4222-8222-222222222222'
    )$$,
  '42501',
  null,
  'el tercero no puede escribir en un hilo ajeno'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Marcar como leído
-- ────────────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$select public.mark_conversation_read((select requester_conv from chat_test_ids))$$,
  'el dueño marca el hilo como leído'
);

select is(
  (select public.unread_chat_count()),
  0::bigint,
  'el contador de no leídos vuelve a cero'
);

select is(
  (select count(*) from public.notifications
    where type = 'MESSAGE' and is_read = false),
  0::bigint,
  'la notificación MESSAGE se apaga al leer'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Bloqueo: corta el envío aunque el hilo ya exista
-- ────────────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select lives_ok(
  $$insert into public.profile_blocks (blocker_profile_id, blocked_profile_id)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'el usuario puede bloquear al dueño'
);

select throws_ok(
  $$select public.send_message(
      (select requester_conv from chat_test_ids),
      '¿Sigues ahí?',
      'f3333333-3333-4333-8333-333333333333'
    )$$,
  '42501',
  null,
  'el bloqueo impide enviar al usuario bloqueado'
);

select lives_ok(
  $$delete from public.profile_blocks
    where blocker_profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and blocked_profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'el usuario puede desbloquear'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Respuesta del dueño
-- ────────────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$select public.send_message(
      (select requester_conv from chat_test_ids),
      'Sí, sigue perdido. Gracias por avisar.',
      'f4444444-4444-4444-8444-444444444444'
    )$$,
  'el dueño responde'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select is(
  (select public.unread_chat_count()),
  1::bigint,
  'el interesado recibe el no leído de la respuesta'
);

select lives_ok(
  $$select public.mark_conversation_read((select requester_conv from chat_test_ids))$$,
  'el interesado marca la respuesta como leída'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Resolver la publicación: archivo en solo lectura
-- ────────────────────────────────────────────────────────────────────────────
reset role;

update public.publications
   set status = 'RESOLVED'
 where id = 'e1111111-1111-4111-8111-111111111111';

select is(
  (select count(*) from public.conversations
    where publication_id = 'e1111111-1111-4111-8111-111111111111'
      and archived_at is not null),
  2::bigint,
  'resolver la publicación archiva todos sus hilos'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select is(
  (select public.start_conversation('e1111111-1111-4111-8111-111111111111')),
  (select requester_conv from chat_test_ids),
  'el hilo archivado se puede abrir en solo lectura'
);

select throws_ok(
  $$select public.send_message(
      (select requester_conv from chat_test_ids),
      'Mensaje con la publicación resuelta',
      'f5555555-5555-4555-8555-555555555555'
    )$$,
  '23514',
  null,
  'no se puede escribir en un hilo archivado'
);

-- Una publicación distinta, resuelta y sin hilo previo, no admite uno nuevo.
reset role;

update public.publications
   set status = 'RESOLVED'
 where id = 'e2222222-2222-4222-8222-222222222222';

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select throws_ok(
  $$select public.start_conversation('e2222222-2222-4222-8222-222222222222')$$,
  '42501',
  null,
  'una publicación resuelta no admite hilos nuevos'
);

-- Reabrir la publicación reactiva el hilo.
reset role;

update public.publications
   set status = 'ACTIVE'
 where id = 'e1111111-1111-4111-8111-111111111111';

select is(
  (select count(*) from public.conversations
    where publication_id = 'e1111111-1111-4111-8111-111111111111'
      and archived_at is not null),
  0::bigint,
  'volver a ACTIVE reabre los hilos'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select lives_ok(
  $$select public.send_message(
      (select requester_conv from chat_test_ids),
      'Qué buena noticia.',
      'f6666666-6666-4666-8666-666666666666'
    )$$,
  'tras reabrir, el hilo vuelve a admitir mensajes'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Reporte y lectura de moderación
-- ────────────────────────────────────────────────────────────────────────────
select throws_ok(
  $$insert into public.message_reports (message_id, conversation_id, reporter_profile_id, reason, status)
    select m.id, m.conversation_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'SPAM', 'RESOLVED'
      from public.messages m
     where m.conversation_id = (select requester_conv from chat_test_ids)
     order by m.created_at asc
     limit 1$$,
  '42501',
  null,
  'el denunciante no puede crear un reporte ya resuelto'
);

select lives_ok(
  $$insert into public.message_reports (message_id, conversation_id, reporter_profile_id, reason, details)
    select m.id, m.conversation_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'HARASSMENT', 'prueba pgTAP'
      from public.messages m
     where m.conversation_id = (select requester_conv from chat_test_ids)
     order by m.created_at asc
     limit 1$$,
  'un participante puede reportar un mensaje'
);

set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';

select ok(
  (select count(*) from public.moderation_reported_context(
      (select id from public.message_reports order by created_at desc limit 1)
   )) > 0,
  'moderación lee el contexto de un mensaje reportado'
);

select is(
  (select count(*) from public.moderation_reported_context(
      (select id from public.message_reports order by created_at desc limit 1)
   )
   where is_reported),
  1::bigint,
  'el contexto identifica exactamente el mensaje reportado'
);

select is(
  (select count(*) from public.messages
    where conversation_id = (select requester_conv from chat_test_ids)),
  0::bigint,
  'moderación no puede hojear el hilo sin pasar por el reporte'
);

set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select throws_ok(
  $$select * from public.moderation_reported_context(
      (select id from public.message_reports order by created_at desc limit 1)
    )$$,
  '42501',
  null,
  'un usuario normal no puede usar la vista de moderación'
);

reset role;

select ok(
  (select count(*) from public.audit_logs
    where action = 'CHAT_MODERATION_VIEW') >= 1,
  'cada lectura de moderación deja auditoría'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Contacto compartido con consentimiento
-- ────────────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$select public.share_publication_contact((select requester_conv from chat_test_ids))$$,
  'el dueño comparte su contacto dentro del hilo'
);

select ok(
  (select c.contact_shared_at from public.conversations c
    where c.id = (select requester_conv from chat_test_ids)) is not null,
  'el hilo queda marcado como contacto compartido'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select is(
  (select contact_phone from public.get_shared_contact((select requester_conv from chat_test_ids))),
  '+5355555555',
  'el interesado lee el contacto compartido'
);

set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select throws_ok(
  $$select * from public.get_shared_contact((select requester_conv from chat_test_ids))$$,
  '42501',
  null,
  'un tercero no lee el contacto compartido'
);

reset role;

select is(
  (select count(*) from public.audit_logs where action = 'CONTACT_SHARED'),
  1::bigint,
  'compartir el contacto queda auditado'
);

select ok(
  (select count(*) from public.audit_logs where action = 'CONTACT_VIEWED_SHARED') >= 1,
  'leer el contacto compartido también queda auditado'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. Anon no tiene acceso
-- ────────────────────────────────────────────────────────────────────────────
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select public.start_conversation('e1111111-1111-4111-8111-111111111111')$$,
  '42501',
  null,
  'anon no puede abrir conversaciones'
);

select throws_ok(
  $$select count(*) from public.messages$$,
  '42501',
  null,
  'anon no puede leer mensajes'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 12. Retención
-- ────────────────────────────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select throws_ok(
  $$select public.purge_archived_conversations(90)$$,
  '42501',
  null,
  'un usuario normal no puede purgar hilos'
);

reset role;

update public.conversations
   set archived_at = now() - interval '200 days'
 where publication_id = 'e1111111-1111-4111-8111-111111111111';

update public.publications
   set status = 'RESOLVED'
 where id = 'e1111111-1111-4111-8111-111111111111';

set local role service_role;

select is(
  public.purge_archived_conversations(90),
  2,
  'service_role purga los hilos archivados hace más de 90 días'
);

reset role;

select is(
  (select count(*) from public.conversations),
  0::bigint,
  'los hilos purgados desaparecen'
);

select is(
  (select count(*) from public.messages),
  0::bigint,
  'los mensajes se borran en cascada'
);

select is(
  (select count(*) from public.notifications where link like '/mensajes/%'),
  0::bigint,
  'la purga no deja notificaciones con enlaces muertos'
);

select * from finish();

rollback;
