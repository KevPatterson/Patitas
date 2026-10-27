-- 0023_notifications_fixes.sql
-- Correcciones del sistema de notificaciones detectadas al revisar /notificaciones:
--
--   1. No existía política RLS de DELETE. PostgREST no devolvía error al borrar,
--      pero la fila seguía en la tabla: la notificación reaparecía al recargar.
--   2. La tabla no estaba en la publicación supabase_realtime, así que
--      subscribeToNotifications() nunca recibía INSERTs.
--   3. REPLICA IDENTITY por defecto solo incluye la clave primaria. Sin FULL,
--      los eventos DELETE no llevan `profile_id` y el filtro del canal no puede
--      evaluarse.
--   4. Faltaba un índice que cubriera la paginación por fecha (el existente
--      empieza por `is_read` y no sirve para "todas", ordenadas por created_at).
--
-- La migración es idempotente: se puede reaplicar sin duplicar objetos.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. El dueño puede eliminar sus propias notificaciones
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "profile owner can delete notifications" on public.notifications;

create policy "profile owner can delete notifications"
on public.notifications for delete using (
  profile_id = auth.uid()
);

comment on policy "profile owner can delete notifications" on public.notifications is
  'Cada usuario puede borrar solo sus notificaciones. Sin esta política, PostgREST devolvía 0 filas sin error y el aviso reaparecía al recargar.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Índice para la lista paginada y el contador
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists notifications_profile_created_index
  on public.notifications (profile_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Realtime
-- ════════════════════════════════════════════════════════════════════════════
--
-- REPLICA IDENTITY FULL es necesario para que los DELETE incluyan profile_id y
-- el filtro `profile_id=eq.<uid>` del canal pueda descartar los ajenos. El
-- volumen de notificaciones es bajo, así que el coste extra en WAL es aceptable.

alter table public.notifications replica identity full;

do $do$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$do$;
