-- ════════════════════════════════════════════════════════════════════════════
-- Migración 0024 — Filtros avanzados del buscador
-- ════════════════════════════════════════════════════════════════════════════
--
-- Añade a `search_publications` los filtros que faltaban para que la búsqueda
-- con texto (FTS) y la búsqueda básica devuelvan exactamente el mismo conjunto
-- de resultados:
--
--   filter_age   → edad aproximada (puppy, young, adult, senior…)
--   filter_zone  → zona dentro del municipio (texto libre, coincidencia parcial)
--   until_date   → fecha final inclusiva de publicación
--
-- También devuelve `age_approx` y `resolved_at`, que el cliente necesita para
-- pintar los resultados y las historias de éxito sin una segunda consulta.
--
-- La firma cambia (de 11 a 14 argumentos), así que no se puede usar
-- `create or replace`: hay que eliminar la versión anterior primero. Los
-- parámetros nuevos tienen valor por defecto, de modo que cualquier cliente que
-- siga enviando solo los 11 anteriores continúa funcionando.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.search_publications(
  text,
  public.publication_type,
  text,
  text,
  text,
  public.publication_status,
  text,
  text,
  date,
  integer,
  integer
);

create or replace function public.search_publications(
  search_query text default null,
  filter_type public.publication_type default null,
  filter_species text default null,
  filter_sex text default null,
  filter_size text default null,
  filter_status public.publication_status default 'ACTIVE',
  filter_province text default null,
  filter_municipality text default null,
  filter_age text default null,
  filter_zone text default null,
  since_date date default null,
  until_date date default null,
  result_limit integer default 50,
  result_offset integer default 0
)
returns table(
  id uuid,
  slug text,
  title text,
  description text,
  type public.publication_type,
  status public.publication_status,
  species text,
  breed text,
  sex text,
  size text,
  color text,
  age_approx text,
  published_at timestamptz,
  resolved_at timestamptz,
  rank real
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  ts_query tsquery;
begin
  -- Construir tsquery si hay texto de búsqueda
  if search_query is not null and trim(search_query) != '' then
    ts_query := plainto_tsquery('spanish', search_query);
  end if;

  return query
  select
    p.id,
    p.slug,
    p.title,
    p.description,
    p.type,
    p.status,
    p.species,
    p.breed,
    p.sex,
    p.size,
    p.color,
    p.age_approx,
    p.published_at,
    p.resolved_at,
    case
      when ts_query is not null then ts_rank(p.search_vector, ts_query)
      else 0
    end as rank
  from public.publications p
  left join public.locations l on p.location_id = l.id
  where
    p.deleted_at is null
    and (filter_status is null or p.status = filter_status)
    and (filter_type is null or p.type = filter_type)
    and (filter_species is null or lower(p.species) = lower(filter_species))
    and (filter_sex is null or p.sex = filter_sex)
    and (filter_size is null or p.size = filter_size)
    and (filter_age is null or lower(p.age_approx) = lower(filter_age))
    and (filter_province is null or l.province = filter_province)
    and (filter_municipality is null or l.municipality = filter_municipality)
    and (filter_zone is null or l.zone ilike '%' || filter_zone || '%')
    and (since_date is null or p.published_at >= since_date)
    and (until_date is null or p.published_at < (until_date + 1))
    and (ts_query is null or p.search_vector @@ ts_query)
  order by
    case when ts_query is not null then ts_rank(p.search_vector, ts_query) else 0 end desc,
    p.published_at desc
  limit result_limit
  offset result_offset;
end;
$$;

-- Búsqueda parcial de zona: el índice trigram evita un seq scan cuando la
-- tabla de ubicaciones crece (la extensión ya se creó en 0008).
create index if not exists locations_zone_trgm_idx
  on public.locations using gin (zone gin_trgm_ops)
  where zone is not null;

-- Filtro de edad combinado con estado y fecha, el patrón más común del buscador.
create index if not exists publications_age_status_date_idx
  on public.publications (age_approx, status, published_at desc)
  where deleted_at is null;

revoke all on function public.search_publications(
  text,
  public.publication_type,
  text,
  text,
  text,
  public.publication_status,
  text,
  text,
  text,
  text,
  date,
  date,
  integer,
  integer
) from public, anon;

grant execute on function public.search_publications(
  text,
  public.publication_type,
  text,
  text,
  text,
  public.publication_status,
  text,
  text,
  text,
  text,
  date,
  date,
  integer,
  integer
) to authenticated, service_role;

comment on function public.search_publications(
  text,
  public.publication_type,
  text,
  text,
  text,
  public.publication_status,
  text,
  text,
  text,
  text,
  date,
  date,
  integer,
  integer
) is
  'Búsqueda con FTS y filtros combinados: tipo, especie, sexo, tamaño, estado, provincia, municipio, edad, zona, fecha desde y fecha hasta.';
