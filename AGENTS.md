# AGENTS.md — Patitas

SPA de mascotas perdidas/encontradas/adopción (contexto Cuba). Vite + React 19 + TypeScript en `src/`, Vercel Functions en `api/`, Supabase (Postgres + RLS + Auth + Storage) como backend.

## Comandos

```bash
npm ci                 # instalar (CI usa npm ci)
npm run dev            # SPA en :5173 — NO sirve /api/*
vercel dev             # necesario para probar /api/* en local
npm run lint           # eslint . --max-warnings 0
npm run typecheck      # tsc -b (cubre src + api + tooling)
npm run build          # tsc -b && vite build
npm test               # vitest run (215 tests, sin env ni servicios externos)
npm run validate:sql   # valida supabase/migrations (también corre como test)
npm run seed:test      # publicaciones de prueba; requiere .env
```

- Verificación antes de commit: `npm run lint && npm run typecheck && npm test`. El CI (`.github/workflows/ci.yml`) añade `build`, `validate:sql` y `npm audit --audit-level=high`.
- Un solo test: `npx vitest run src/lib/__tests__/secrets.test.ts` (no hay `vitest.config`; usa los defaults).
- Node 22 (runtime de las Functions); CI y Vercel lo usan.

## Arquitectura

- `src/main.tsx` → `AuthProvider` → `BrowserRouter` → `src/app/App.tsx` (define rutas, `SiteShell` y `BottomNav`).
- El frontend habla **directo con Supabase** protegido por RLS. `api/` existe solo para operaciones privilegiadas (moderación, IA, rate limiting, ingesta, subida de imágenes). Cada archivo en `api/` es un endpoint.
- `tsconfig.json` referencia `app`, `api` y `node`; `tsc -b` cubre los tres. `tsconfig.api.json` es `noEmit` (Vercel compila las funciones).
- `workers/telegram-collector/` es un worker Python independiente: fuera del build npm y ESLint lo ignora.
- `vercel.json`: rewrite catch-all a `index.html` (SPA) + rutas de `/sitemap.xml`, `/p` para bots OG y `/api`.

## Límite de Vercel Hobby (12 Functions)

- El plan Hobby permite **máximo 12 Serverless Functions por deployment**; si se pasa, el deploy falla con `No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan`.
- Cada archivo `.ts` en `api/` que Vercel trate como endpoint cuenta como una Function. Los archivos que empiezan con `_` (p. ej. `api/_lib/`) **no** cuentan: ahí va todo el código compartido y los helpers.
- **Antes de crear un archivo nuevo en `api/`**, cuenta los endpoints actuales y confirma que quedas en ≤ 12. Si ya estás en el tope, NO agregues otro archivo: consolida.
- Cómo consolidar (en orden de preferencia):
  1. Agrupar endpoints relacionados en una sola Function con un parámetro de acción (`?action=...` o `POST { action }`) y despachar internamente a handlers que vivan en `api/_lib/`.
  2. Usar una ruta dinámica (`api/[resource].ts`) que despache por `req.query.resource`.
  3. Mover a Supabase lo que no necesite privilegios (RLS, RPC/funciones SQL) en vez de crear otro endpoint.
- Lógica nueva = módulo en `api/_lib/`, no endpoint nuevo, salvo que sea imprescindible.
- Al agregar o consolidar endpoints, actualiza los rewrites de `vercel.json` si cambian las rutas públicas, y no rompas los contratos que consume `src/`.
- No sugieras "pasar a Pro" como solución: el proyecto debe seguir cabiendo en Hobby.

## Supabase / migraciones

- `supabase/migrations/` está numerado secuencialmente. **No edites una migración ya aplicada**: crea la siguiente.
- `npm run validate:sql` exige migraciones idempotentes: `drop ... if exists`, sin `create policy`/`create trigger` duplicados, firmas exactas en `grant/revoke`. El script es la única red estática (no hay Postgres/Docker en CI); córrelo antes de commitear SQL.
- `supabase/tests/` contiene pruebas pgTAP.
- RLS activo en todas las tablas. Datos sensibles (`publications.contact_*`, `pets.microchip_private`) no tienen SELECT directo: se leen solo por funciones como `reveal_publication_contact()` (con cuota y auditoría).

## Seguridad (verificada por tests)

- `src/lib/__tests__/secrets.test.ts` falla si `src/` menciona `SUPABASE_SERVICE_ROLE_KEY`/`service_role`, importa algo de `api/`, o usa `import.meta.env.*` sin prefijo `VITE_`. Los secretos de servidor viven solo en `api/_lib`.
- `.env.example` es la fuente de verdad de variables. Flags `VITE_*` de IA están en `false` a propósito (con `AI_PROVIDER=MOCK` los resultados son inventados y no deben presentarse como reales).

## Estilos

- Tailwind v4: los tokens viven en `@theme` de `src/styles/globals.css`. `tailwind.config.js` **no** se importa (es legacy, sin `@config`): editarlo no tiene efecto.
- Los tokens semánticos usan indirección `var(--theme-*)`; no pongas `hsl(var(--x))` dentro de `@theme` o Tailwind no genera utilidades.

## Convenciones del repo

- Commits en español (Conventional Commits), participio sin "se" ("Agregada validación"), subject ≤ 72.
- Comentarios de código en español. TS strict; `any` prohibido por convención (ESLint lo marca como warning).
- No crear documentación nueva salvo en `docs/`.
