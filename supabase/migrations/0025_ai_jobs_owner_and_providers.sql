-- Migración 0025: visibilidad de los trabajos de IA y valores reales de proveedor
--
-- 1) `ai_processing_jobs` solo era legible por MODERATOR/ADMIN. El dueño de la
--    publicación no podía leer el estado de su propio análisis, así que el
--    badge se quedaba en «pendiente» y nunca mostraba resultados.
-- 2) El enum `ai_provider` no incluía los valores que usa la API
--    (MOCK, TESSERACT, GOOGLE_VISION) y los inserts de resultados fallaban con
--    «invalid input value for enum ai_provider».

alter type public.ai_provider add value if not exists 'MOCK';
alter type public.ai_provider add value if not exists 'TESSERACT';
alter type public.ai_provider add value if not exists 'GOOGLE_VISION';

drop policy if exists "publication owners can read ai jobs" on public.ai_processing_jobs;

create policy "publication owners can read ai jobs"
on public.ai_processing_jobs for select using (
  exists (
    select 1 from public.publications p
    where p.id = ai_processing_jobs.publication_id
    and p.owner_profile_id = auth.uid()
  )
);
