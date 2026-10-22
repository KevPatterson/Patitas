-- ════════════════════════════════════════════════════════════════════════════
-- Migración 0018 — Perfiles para usuarios creados por teléfono
-- ════════════════════════════════════════════════════════════════════════════
--
-- El acceso por OTP (SMS/WhatsApp) crea usuarios de Supabase sin correo. La
-- función `handle_new_user()` usaba `split_part(new.email, '@', 1)`, que devuelve
-- NULL cuando el email no existe; como `profiles.username` es NOT NULL, el
-- trigger fallaba y la cuenta quedaba sin perfil.
--
-- Se conserva el comportamiento para correo/OAuth y se añade un respaldo basado
-- en el UUID para las cuentas sin email.
--
-- Idempotente: solo reemplaza la función.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 12)
    ),
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update set
    username = excluded.username,
    full_name = excluded.full_name,
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    updated_at = now();

  return new;
end;
$fn$;

comment on function public.handle_new_user() is
  'Crea el perfil al registrarse; usa el UUID como usuario de respaldo cuando la cuenta no tiene email (acceso por teléfono).';
