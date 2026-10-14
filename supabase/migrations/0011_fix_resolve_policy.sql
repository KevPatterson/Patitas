-- Migración 0011: Corregir política RLS para resolvePublication
-- El error "more than one row returned by a subquery used as an expression" (código 21000)
-- ocurre porque la subconsulta en WITH CHECK es ambigua.

-- Eliminar la política problemática
drop policy if exists "owners can update own publications" on public.publications;

-- Crear política corregida
-- Usar correlación explícita: p.id = id (donde id sin prefijo se refiere al NEW row de la política)
create policy "owners can update own publications"
on public.publications for update using (
  owner_profile_id = auth.uid() 
  or exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() 
    and p.role in ('MODERATOR', 'ADMIN')
  )
) with check (
  -- Prevenir cambio de owner_profile_id: comparar NEW.owner_profile_id con el valor original
  -- La subconsulta correlacionada usa 'p' como alias y 'id' (sin prefijo) se refiere al NEW row
  owner_profile_id = (select p.owner_profile_id from public.publications p where p.id = id)
  and (
    owner_profile_id = auth.uid() 
    or exists (
      select 1 from public.profiles pr 
      where pr.id = auth.uid() 
      and pr.role in ('MODERATOR', 'ADMIN')
    )
  )
);

comment on policy "owners can update own publications" on public.publications is 
  'Permite al owner o moderadores actualizar sus publicaciones, previniendo cambio de owner_profile_id (fix: subquery correlacionada)';