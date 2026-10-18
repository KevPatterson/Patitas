-- ============================================================================
-- seed.sql — datos de ejemplo para desarrollo LOCAL
-- ============================================================================
-- IMPORTANTE (léelo antes de tocar este archivo):
--
--   * Este archivo NUNCA se aplica a producción. `supabase db push` aplica
--     únicamente `supabase/migrations/`; el seed solo lo ejecuta
--     `supabase db reset` / `supabase start` contra la base de datos local.
--   * NO crees usuarios aquí. Las cuentas de `auth.users` con contraseña
--     conocida son exactamente el riesgo que la auditoría marcó como DOC-01
--     (ver docs/AUDITORIA_SEGURIDAD.md). Crea tus cuentas locales a mano en
--     Supabase Studio (http://127.0.0.1:54323 → Authentication → Users); el
--     trigger `on_auth_user_created` crea el `profiles` correspondiente.
--   * Sin usuarios no hay publicaciones de ejemplo: los datos que dependen de
--     `owner_profile_id` se omiten a propósito.
--   * Para publicaciones de prueba usa `npm run seed:test`, que reutiliza un
--     perfil existente y aborta si no hay ninguno (scripts/seed-test-publications.mjs).
--
-- Este archivo es idempotente: se puede ejecutar varias veces sin duplicar.
-- ============================================================================

-- Ciudades de referencia (no hay FK a usuarios: seguro de insertar siempre).
insert into public.locations (province, municipality, zone, approximate_lat, approximate_lng)
select 'La Habana', 'Plaza de la Revolución', 'Vedado', 23.1365, -82.3855
where not exists (
  select 1 from public.locations
  where province = 'La Habana' and municipality = 'Plaza de la Revolución' and zone = 'Vedado'
);

insert into public.locations (province, municipality, zone, approximate_lat, approximate_lng)
select 'Santiago de Cuba', 'Santiago de Cuba', 'Centro Histórico', 20.0247, -75.8215
where not exists (
  select 1 from public.locations
  where province = 'Santiago de Cuba' and municipality = 'Santiago de Cuba' and zone = 'Centro Histórico'
);

-- Comprobación final: recuerda que no debe haber usuarios semilla.
do $$
declare
  seed_users int;
begin
  select count(*) into seed_users
  from auth.users
  where email in ('ana@patitas.dev', 'luis@patitas.dev', 'mod@patitas.dev');

  if seed_users > 0 then
    raise warning 'Se encontraron % cuentas semilla obsoletas en auth.users. Bórralas: ver docs/AUDITORIA_SEGURIDAD.md (DOC-01).', seed_users;
  end if;
end
$$;
