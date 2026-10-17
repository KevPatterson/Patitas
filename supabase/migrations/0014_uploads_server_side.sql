-- ════════════════════════════════════════════════════════════════════════════
-- Migración 0014 — Las subidas pasan obligatoriamente por /api/uploads
-- ════════════════════════════════════════════════════════════════════════════
--
-- Problema: aunque el cliente reenco Dee la imagen y quite el EXIF, un usuario
-- puede subir la foto original directamente con supabase-js y la anon key. Toda
-- validación que viva solo en el cliente (o solo en /api) es saltable, y en
-- Storage no hay RLS que pueda inspeccionar los BYTES de un objeto.
--
-- La única forma de que el saneado sea obligatorio es quitar la capacidad de
-- escribir en el bucket a `authenticated` y dejar las escrituras en manos del
-- service role desde `/api/uploads`, que:
--
--   1. valida el tipo real por magic bytes (JPEG/PNG/WebP; rechaza SVG y GIF),
--   2. rechaza la imagen si lleva GPS en EXIF,
--   3. reencodea a WebP sin metadatos,
--   4. limita el lado largo a 1600 px (512 en avatares) y el peso a 1 MB (300 KB),
--   5. genera el nombre con un uuid, nunca el del archivo original.
--
-- Lo que NO cambia:
--   - Las imágenes se siguen sirviendo por URL pública (no pasan por RLS).
--   - El bucket conserva `file_size_limit` y `allowed_mime_types`.
--   - Los moderadores siguen pudiendo borrar (vía API, con su rol comprobado).
--
-- Todo es idempotente.
--
-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────────────
-- Reaplicar las políticas de 0006_storage_security_fixes.sql:
--   create policy "owners can upload to own publications" on storage.objects
--     for insert with check (bucket_id='pet-images' and ...);
--   create policy "owners can update own pet-images" on storage.objects for update using (...);
--   create policy "owners can delete own pet-images" on storage.objects for delete using (...);
--   create policy "moderators can delete pet-images" on storage.objects for delete using (...);
--   create policy "users can upload own avatar" on storage.objects for insert with check (...);
--   create policy "users can update own avatar" on storage.objects for update using (...);
--   create policy "users can delete own avatar" on storage.objects for delete using (...);
-- ════════════════════════════════════════════════════════════════════════════

-- ── pet-images: solo el service role escribe ────────────────────────────────
drop policy if exists "authenticated users can upload pet-images" on storage.objects;
drop policy if exists "owners can upload to own publications" on storage.objects;
drop policy if exists "owners can update own pet-images" on storage.objects;
drop policy if exists "owners can delete own pet-images" on storage.objects;
drop policy if exists "moderators can delete pet-images" on storage.objects;

-- ── avatars: solo el service role escribe ───────────────────────────────────
drop policy if exists "users can upload own avatar" on storage.objects;
drop policy if exists "users can update own avatar" on storage.objects;
drop policy if exists "users can delete own avatar" on storage.objects;

-- ── Refuerzo ────────────────────────────────────────────────────────────────
-- `storage.objects` tiene RLS activo (lo gestiona Supabase), así que sin política
-- de INSERT/UPDATE/DELETE para `authenticated` la escritura queda denegada. No se
-- toca el GRANT a nivel de tabla a propósito: sería un martillo global sobre un
-- esquema compartido y afectaría a cualquier bucket futuro.

-- ── Los buckets siguen con sus límites; se reafirman por si alguien los cambió ──
update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
 where id = 'pet-images';

update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
 where id = 'avatars';

-- ── Trazabilidad: cada imagen nueva debe tener un nombre generado por el
--    servidor (uuid.webp), lo que delata cualquier objeto subido por otra vía.
--
-- Se añade como NOT VALID: las filas antiguas tienen nombres como
-- `<pubId>/<timestamp>-0.jpg` y validarlas rompería la migración. NOT VALID
-- aplica la restricción a los INSERT/UPDATE nuevos y deja el histórico intacto.
do $do$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'publication_images_server_generated_path'
       and conrelid = 'public.publication_images'::regclass
  ) then
    alter table public.publication_images
      add constraint publication_images_server_generated_path
      check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
      not valid;
  end if;
end
$do$;

comment on constraint publication_images_server_generated_path on public.publication_images is
  'Valida que el path sea <publication_uuid>/<image_uuid>.webp, es decir, generado por /api/uploads. NOT VALID: solo aplica a filas nuevas.';
