-- ════════════════════════════════════════════════════════════════════════════
-- Migración 0016 — Corregir los privilegios por columna (el REVOKE no bastaba)
-- ════════════════════════════════════════════════════════════════════════════
--
-- BUG ENCONTRADO AL VERIFICAR 0013 Y 0014:
--
--   select grantee from information_schema.column_privileges
--    where table_name = 'publications' and column_name = 'contact_phone';
--   -- devolvía `authenticated` y `anon`  ← la protección NO estaba aplicada
--
-- Motivo: en PostgreSQL los privilegios de TABLA y los de COLUMNA son
-- independientes. `REVOKE SELECT (contact_phone) ... FROM anon` solo elimina una
-- concesión a nivel de columna; si el rol tiene `SELECT` a nivel de tabla (que es
-- lo que concede Supabase por defecto a `anon` y `authenticated`), **sigue
-- leyendo todas las columnas**. Un `REVOKE` de columna sobre un `GRANT` de tabla
-- es un no-op silencioso.
--
-- La forma correcta de restringir columnas es la inversa:
--
--   1. REVOKE SELECT ON TABLE            (quita el privilegio de tabla)
--   2. GRANT SELECT (col1, col2, …)      (concede solo las columnas permitidas)
--
-- Los privilegios de INSERT/UPDATE/DELETE no se tocan: el cliente sigue creando y
-- editando publicaciones con la RLS de siempre.
--
-- La lista de columnas se genera desde `information_schema.columns` en lugar de
-- escribirse a mano, para que añadir una columna nueva no la deje sin permiso de
-- lectura ni obligue a tocar esta migración.
--
-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────────────
--   grant select on public.publications to anon, authenticated;
--   grant select on public.pets to anon, authenticated;
--   (las concesiones por columna se vuelven irrelevantes al existir la de tabla)
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. publications: todo menos los datos de contacto
-- ════════════════════════════════════════════════════════════════════════════

do $do$
declare
  v_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'publications'
     and column_name not in ('contact_phone', 'contact_whatsapp', 'contact_email');

  if v_columns is null then
    raise exception 'No se encontraron columnas en public.publications';
  end if;

  -- Paso 1: quitar el privilegio de tabla (el REVOKE por columna no lo hacía).
  revoke select on public.publications from anon, authenticated;

  -- Paso 2: conceder solo las columnas públicas.
  execute format(
    'grant select (%s) on public.publications to anon, authenticated',
    v_columns
  );

  raise notice 'publications: SELECT restringido a % columnas (sin contact_*)', array_length(string_to_array(v_columns, ','), 1);
end
$do$;

comment on column public.publications.contact_phone is
  'PII. Sin privilegio de columna para anon ni authenticated: se obtiene con reveal_publication_contact().';

comment on column public.publications.contact_whatsapp is
  'PII. Sin privilegio de columna para anon ni authenticated: se obtiene con reveal_publication_contact().';

comment on column public.publications.contact_email is
  'PII. Sin privilegio de columna para anon ni authenticated: se obtiene con reveal_publication_contact().';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. pets: todo menos el microchip
-- ════════════════════════════════════════════════════════════════════════════
--
-- La RLS de `pets` ya limita las filas al dueño y a moderación, pero el mismo
-- error de concepto hacía que el REVOKE por columna de la 0014 no protegiera nada
-- de cara a futuras políticas más amplias.

do $do$
declare
  v_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'pets'
     and column_name <> 'microchip_private';

  if v_columns is null then
    raise notice 'public.pets no existe; se omite';
    return;
  end if;

  revoke select on public.pets from anon, authenticated;

  execute format(
    'grant select (%s) on public.pets to anon, authenticated',
    v_columns
  );
end
$do$;

comment on column public.pets.microchip_private is
  'Dato sensible. Sin privilegio de columna para anon ni authenticated: solo el service role lo lee.';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Comprobación de que el resultado es el esperado
-- ════════════════════════════════════════════════════════════════════════════
--
-- Se deja como WARNING (no como excepción) para no bloquear la migración si el
-- entorno tiene particularidades, pero deja constancia en el log de `db push`.

do $do$
declare
  v_leaks int;
begin
  select count(*) into v_leaks
    from information_schema.column_privileges
   where table_schema = 'public'
     and table_name = 'publications'
     and column_name in ('contact_phone', 'contact_whatsapp', 'contact_email')
     and grantee in ('anon', 'authenticated');

  if v_leaks > 0 then
    raise warning 'Todavía hay % privilegios sobre columnas de contacto: revisa los GRANT del proyecto', v_leaks;
  else
    raise notice 'OK: anon y authenticated no tienen privilegios sobre contact_phone/contact_whatsapp/contact_email';
  end if;
end
$do$;
