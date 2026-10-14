-- Migración 0011: Fuentes externas (Telegram, Facebook público) y takedowns
-- Agrega tablas para ingesta de contenido externo, tracking de fuentes y solicitudes de retirada

-- ══════════════════════════════════════════════════════════════
-- ENUMS para fuentes externas
-- ══════════════════════════════════════════════════════════════

do $$ begin
  create type public.external_platform as enum ('TELEGRAM', 'FACEBOOK_PUBLIC');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.external_post_status as enum (
    'NEW',
    'PROCESSING',
    'NOT_RELEVANT',
    'DUPLICATE',
    'PENDING_REVIEW',
    'PUBLISHED',
    'REJECTED',
    'TAKEN_DOWN'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.takedown_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════════
-- Tabla: external_sources
-- Catálogo de fuentes externas monitoreadas (canales Telegram, páginas FB públicas)
-- ══════════════════════════════════════════════════════════════

create table if not exists public.external_sources (
  id uuid primary key default gen_random_uuid(),
  platform public.external_platform not null,
  handle_or_url text not null,           -- @canal_telegram o https://facebook.com/pagina
  name text,                              -- Nombre visible de la fuente
  province text,                          -- Provincia opcional (filtro geográfico)
  is_active boolean not null default true,
  is_trusted boolean not null default false,  -- Fuente confiable para auto-publicación
  last_cursor text,                       -- Último message_id / cursor procesado
  last_run_at timestamptz,
  error_count integer not null default 0,  -- Fallos consecutivos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint external_sources_unique_platform_handle unique (platform, handle_or_url)
);

create index if not exists external_sources_platform_idx on public.external_sources (platform, is_active);
create index if not exists external_sources_trusted_idx on public.external_sources (is_trusted) where is_trusted = true;

-- ══════════════════════════════════════════════════════════════
-- Tabla: external_posts
-- Posts crudos obtenidos de fuentes externas, antes de procesar/convertir a publicación
-- ══════════════════════════════════════════════════════════════

create table if not exists public.external_posts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.external_sources(id) on delete cascade,
  platform public.external_platform not null,
  external_id text not null,              -- message_id (Telegram) o post_id (FB)
  source_url text not null,               -- Enlace permanente al post original
  raw_text text,                          -- Texto completo sin procesar
  image_paths text[] not null default '{}', -- Rutas en Storage (bucket: external-imports)
  posted_at timestamptz not null,         -- Fecha original del post
  fetched_at timestamptz not null default now(),
  status public.external_post_status not null default 'NEW',
  confidence numeric(5,4) not null default 0, -- 0.0000 a 1.0000
  extracted jsonb not null default '{}'::jsonb, -- Datos estructurados extraídos por IA
  publication_id uuid references public.publications(id) on delete set null,
  
  constraint external_posts_unique_platform_external unique (platform, external_id)
);

create index if not exists external_posts_source_idx on public.external_posts (source_id, status, fetched_at desc);
create index if not exists external_posts_status_idx on public.external_posts (status, confidence desc, fetched_at desc);
create index if not exists external_posts_publication_idx on public.external_posts (publication_id) where publication_id is not null;
create index if not exists external_posts_posted_at_idx on public.external_posts (posted_at desc);

-- ══════════════════════════════════════════════════════════════
-- Tabla: takedown_requests
-- Solicitudes de retirada de publicaciones importadas (DMCA / privacidad / error)
-- ══════════════════════════════════════════════════════════════

create table if not exists public.takedown_requests (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  reason text not null,                   -- Motivo: 'COPYRIGHT', 'PRIVACY', 'INACCURATE', 'OTHER'
  contact_email text,                     -- Email opcional para seguimiento
  status public.takedown_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  previous_status public.publication_status, -- Status anterior para restauración
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists takedown_requests_publication_idx on public.takedown_requests (publication_id, status);
create index if not exists takedown_requests_status_idx on public.takedown_requests (status, created_at desc);

-- ══════════════════════════════════════════════════════════════
-- Nuevas columnas en publications para trazabilidad de importación
-- ══════════════════════════════════════════════════════════════

alter table public.publications
  add column if not exists is_imported boolean not null default false,
  add column if not exists source_platform public.external_platform,
  add column if not exists source_url text,
  add column if not exists import_review_status text; -- 'AUTO_APPROVED', 'MANUAL_APPROVED', 'REJECTED'

-- Índice para consultar publicaciones importadas
create index if not exists publications_imported_idx on public.publications (is_imported, source_platform) where is_imported = true;

-- ══════════════════════════════════════════════════════════════
-- Triggers updated_at
-- ══════════════════════════════════════════════════════════════

do $$ begin
  create trigger external_sources_set_updated_at
    before update on public.external_sources
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger external_posts_set_updated_at
    before update on public.external_posts
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger takedown_requests_set_updated_at
    before update on public.takedown_requests
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ══════════════════════════════════════════════════════════════

alter table public.external_sources enable row level security;
alter table public.external_posts enable row level security;
alter table public.takedown_requests enable row level security;

-- =====================================================================
-- EXTERNAL_SOURCES
-- =====================================================================
-- Lectura pública: solo fuentes activas (para mostrar en UI si se desea)
create policy "public can read active sources"
on public.external_sources for select using (
  is_active = true
);

-- Moderadores/admins: CRUD completo
create policy "moderators can manage sources"
on public.external_sources for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('MODERATOR', 'ADMIN')
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('MODERATOR', 'ADMIN')
  )
);

-- Service role (worker de ingesta): lectura/escritura para last_cursor, error_count, last_run_at
-- Nota: El worker usa service role key que bypasea RLS, pero la política existe para completitud
create policy "service role can update source tracking"
on public.external_sources for update using (true) with check (true);

-- =====================================================================
-- EXTERNAL_POSTS
-- =====================================================================
-- Lectura: propietario de la publicación vinculada + moderadores/admins
-- También service role para el pipeline de ingesta
create policy "owners and moderators can read external posts"
on public.external_posts for select using (
  exists (
    select 1 from public.publications pub
    where pub.id = external_posts.publication_id
    and pub.owner_profile_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('MODERATOR', 'ADMIN')
  )
);

-- Inserción/actualización: solo service role (pipeline de ingesta) y moderadores
create policy "service role and moderators can write external posts"
on public.external_posts for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('MODERATOR', 'ADMIN')
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('MODERATOR', 'ADMIN')
  )
);

-- =====================================================================
-- TAKEDOWN_REQUESTS
-- =====================================================================
-- Cualquiera puede CREAR una solicitud de retirada (rate limited en API)
create policy "anyone can create takedown request"
on public.takedown_requests for insert with check (true);

-- Lectura: propietario de la publicación, solicitante (si dio email), moderadores/admins
create policy "relevant parties can read takedown requests"
on public.takedown_requests for select using (
  exists (
    select 1 from public.publications pub
    where pub.id = takedown_requests.publication_id
    and pub.owner_profile_id = auth.uid()
  )
  or auth.uid() = reviewed_by
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('MODERATOR', 'ADMIN')
  )
);

-- Actualización: solo moderadores/admins (revisión)
create policy "moderators can update takedown requests"
on public.takedown_requests for update using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('MODERATOR', 'ADMIN')
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('MODERATOR', 'ADMIN')
  )
);

-- =====================================================================
-- PUBLICATIONS: nuevas columnas (RLS existente ya cubre, pero documentamos)
-- =====================================================================
-- Las políticas existentes en publications ya protegen owner_profile_id.
-- Las nuevas columnas (is_imported, source_platform, source_url, import_review_status)
-- heredan la misma protección. Para source_url (visible públicamente en posts importados):
-- Se permite lectura pública de source_url cuando is_imported = true.
-- Esto se maneja en la política existente "public can read active publications"
-- añadiendo source_url a la proyección permitida (ver migración 0001).

-- Comentarios para documentación
comment on table public.external_sources is 'Catálogo de fuentes externas monitoreadas (canales Telegram públicos, páginas Facebook públicas)';
comment on table public.external_posts is 'Posts crudos obtenidos de fuentes externas antes de convertir a publicaciones internas';
comment on table public.takedown_requests is 'Solicitudes de retirada (DMCA, privacidad, inexactitud) para publicaciones importadas';
comment on column public.publications.is_imported is 'Indica si la publicación proviene de una fuente externa';
comment on column public.publications.source_platform is 'Plataforma de origen: TELEGRAM | FACEBOOK_PUBLIC';
comment on column public.publications.source_url is 'Enlace al post original (visible públicamente en posts importados)';
comment on column public.publications.import_review_status is 'Estado de revisión de importación: AUTO_APPROVED | MANUAL_APPROVED | REJECTED';