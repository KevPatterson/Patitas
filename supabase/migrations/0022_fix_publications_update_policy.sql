-- 0022_fix_publications_update_policy.sql
-- Fix del error 21000 al actualizar una publicación:
--   "more than one row returned by a subquery used as an expression"
--
-- Origen: la política "owners can update own publications" de la 0012 comprobaba
-- el dueño con
--   owner_profile_id = (select p.owner_profile_id from public.publications p where p.id = id)
-- Dentro de la subconsulta, `id` sin calificar se resuelve contra `p.id`, no
-- contra la fila que se actualiza. La condición es siempre verdadera y la
-- subconsulta devuelve TODAS las filas de public.publications. Al usarse como
-- expresión escalar, PostgreSQL aborta con 21000.
--
-- Se reescribe sin subconsulta sobre la propia tabla:
--   * USING ya exige que la fila sea del usuario actual (o de un moderador).
--   * WITH CHECK exige que el nuevo owner_profile_id siga siendo el usuario
--     actual, así que un dueño no puede transferir la publicación; un
--     moderador o admin sí puede.
-- Esto mantiene la protección de la 0005/0012 sin la subconsulta ambigua.

drop policy if exists "owners can update own publications" on public.publications;

create policy "owners can update own publications"
on public.publications for update using (
  owner_profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('MODERATOR', 'ADMIN')
  )
) with check (
  owner_profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('MODERATOR', 'ADMIN')
  )
);

comment on policy "owners can update own publications" on public.publications is
  'Permite al owner o moderadores actualizar sus publicaciones. El owner no puede cambiar owner_profile_id; sin subconsulta sobre publications (fix error 21000).';
