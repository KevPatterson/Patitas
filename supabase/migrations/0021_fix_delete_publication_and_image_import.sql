-- 0021_fix_delete_publication_and_image_import.sql
-- Fix para:
-- 1. Error 500 al eliminar publicación: "more than one row returned by a subquery used as an expression"
-- 2. Manejo robusto de errores en triggers de chat

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Reemplazar sync_chat_archive con manejo de errores robusto
-- ════════════════════════════════════════════════════════════════════════════

drop trigger if exists publications_archive_chats on public.publications;
drop function if exists public.sync_chat_archive();

create or replace function public.sync_chat_archive()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- Evitar errores de "more than one row" usando UPDATE directo sin subconsultas
  if new.deleted_at is not null or new.status <> 'ACTIVE' then
    -- Archivar hilos: solo actualizar los que no estén ya archivados
    update public.conversations
       set archived_at = coalesce(archived_at, now())
     where publication_id = new.id
       and archived_at is null;
  else
    -- Reabrir hilos si la publicación vuelve a ACTIVE
    update public.conversations
       set archived_at = null
     where publication_id = new.id
       and archived_at is not null;
  end if;

  return new;
exception
  when others then
    -- Log del error para debugging, pero no romper la eliminación de la publicación
    raise warning 'sync_chat_archive error for publication %: %', new.id, sqlerrm;
    return new;
end;
$fn$;

comment on function public.sync_chat_archive() is
  'Archiva los hilos cuando la publicación deja de estar ACTIVE. Incluye exception handler para evitar bloquear eliminación.';

revoke all on function public.sync_chat_archive() from public, anon, authenticated;

drop trigger if exists publications_archive_chats on public.publications;
create trigger publications_archive_chats
  after update of status, deleted_at on public.publications
  for each row
  execute function public.sync_chat_archive();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Robustez en archive_chats_on_publication_delete
-- ════════════════════════════════════════════════════════════════════════════

drop trigger if exists publications_archive_chats_delete on public.publications;
drop function if exists public.archive_chats_on_publication_delete();

create or replace function public.archive_chats_on_publication_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.conversations
     set archived_at = coalesce(archived_at, now())
   where publication_id = old.id;

  return old;
exception
  when others then
    raise warning 'archive_chats_on_publication_delete error for publication %: %', old.id, sqlerrm;
    return old;
end;
$fn$;

comment on function public.archive_chats_on_publication_delete() is
  'Archiva hilos antes de hard delete de la publicación. Incluye exception handler.';

revoke all on function public.archive_chats_on_publication_delete() from public, anon, authenticated;

create trigger publications_archive_chats_delete
  before delete on public.publications
  for each row
  execute function public.archive_chats_on_publication_delete();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Asegurar que el trigger de search_vector no falle (solo publications)
-- ════════════════════════════════════════════════════════════════════════════

drop trigger if exists publications_search_vector_trigger on public.publications;
drop function if exists public.publications_search_vector_update();

create or replace function public.publications_search_vector_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.search_vector := 
    setweight(to_tsvector('spanish', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(new.species, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(new.breed, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(new.color, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(new.characteristics, '')), 'C');
  
  return new;
exception
  when others then
    raise warning 'search_vector_update error: %', sqlerrm;
    return new;
end;
$$;

comment on function public.publications_search_vector_update() is
  'Actualiza el vector de búsqueda. Incluye exception handler.';

revoke all on function public.publications_search_vector_update() from public, anon, authenticated;

create trigger publications_search_vector_trigger
  before insert or update on public.publications
  for each row
  execute function public.publications_search_vector_update();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Fix para set_updated_at en publications SOLO (no tocar función compartida)
-- ════════════════════════════════════════════════════════════════════════════

drop trigger if exists publications_set_updated_at on public.publications;

create or replace function public.set_updated_at_publications()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
exception
  when others then
    raise warning 'set_updated_at_publications error: %', sqlerrm;
    return new;
end;
$$;

create trigger publications_set_updated_at before update on public.publications for each row execute function public.set_updated_at_publications();

comment on function public.set_updated_at_publications() is 'Actualiza updated_at en publications. Incluye exception handler.';