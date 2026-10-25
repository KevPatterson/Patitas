-- ══════════════════════════════════════════════════════════════
-- 0020 — external_posts.updated_at
--
-- La migración 0011 creó el trigger `external_posts_set_updated_at`, que
-- ejecuta `set_updated_at()` y asigna `new.updated_at`, pero la tabla nunca
-- tuvo esa columna. Cualquier UPDATE fallaba con 42703 («record "new" has no
-- field "updated_at"»): aprobar o rechazar una importación desde /admin
-- devolvía 500 y el post se quedaba en PENDING_REVIEW.
--
-- Idempotente: se puede aplicar varias veces sin efecto adicional.
-- ══════════════════════════════════════════════════════════════

alter table public.external_posts
  add column if not exists updated_at timestamptz not null default now();

comment on column public.external_posts.updated_at is
  'Última modificación del registro; la mantiene el trigger external_posts_set_updated_at';
