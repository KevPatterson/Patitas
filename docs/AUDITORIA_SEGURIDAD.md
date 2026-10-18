# Auditoría de seguridad — Patitas

**Fecha**: Fase 0 (2026)
**Rama**: `fix/fase-0-preparacion-verificacion`
**Alcance**: `api/` (18 archivos), `supabase/migrations/` (12 archivos), `vercel.json`,
`src/` (secretos y puntos de entrada), historial de git y dependencias npm.

## Cómo leer este documento

Cada hallazgo de la auditoría externa venía marcado como `[VERIFICAR]` porque se
generó **sin acceso al código**. Aquí cada uno queda resuelto como:

| Estado | Significado |
|--------|-------------|
| **EXISTE** | El problema es real y está reproducido en el código. |
| **NO EXISTE** | La auditoría externa se equivocaba: el problema no está en el código. **No se toca.** |
| **PARCIAL** | El mecanismo existe pero está incompleto o tiene un hueco concreto. |

La columna **Evidencia** siempre cita `archivo:línea` comprobado a mano.

---

## 1. Resumen ejecutivo

| # | Hallazgo | Estado | Severidad | Fase |
|---|----------|--------|-----------|------|
| DOC-01 | Usuarios semilla con contraseña pública en migraciones | **NO EXISTE** | — | 0 |
| DOC-02 | README documenta usuarios semilla que no existen | **EXISTE** | Baja | 0 ✅ |
| DOC-03 | No había `supabase/seed.sql` para desarrollo local | **NO EXISTE** el seed previo | Baja | 0 ✅ |
| SEC-01 | Claves expuestas en el historial de git | **NO EXISTE** | — | — |
| DEP-01 | 12 vulnerabilidades npm (10 altas) | **EXISTE** | Alta | 0 ✅ |
| DEP-02 | `api/` no estaba en ningún `tsconfig` (sin verificación de tipos) | **EXISTE** | Media | 0 ✅ |
| API-01 | `/api/admin/moderation`: rol desde BD + JWT correctos | **PARCIAL** | Media | 1 |
| API-02 | `calculate-matches` / `detect-duplicates`: IDOR de lectura | **EXISTE** | **Alta** | 1 |
| API-03 | `create-match`: acepta scores del cliente y no comprueba propiedad | **EXISTE** | **Alta** | 1 |
| API-04 | `/api/takedown`: cualquiera (anónimo) oculta cualquier publicación | **EXISTE** | **Crítica** | 1 |
| API-05 | SSRF vía `imageUrl` en `extract-from-image` y `facebook-link` | **EXISTE** | **Alta** | 1 |
| API-06 | Rate limit en memoria, por IP spoofeable, sin cuota por usuario | **EXISTE** | Alta | 2 |
| API-07 | HMAC de ingesta no firma el contenido (`raw_text`, `image_paths`) | **EXISTE** | **Alta** | 1 |
| API-08 | Fuga de `error.message` interno en respuestas 500 | **EXISTE** | Media | 1 |
| API-09 | Comparación de secreto no timing-safe (`process-job`) | **EXISTE** | Baja | 1 |
| API-10 | `SUPABASE_SERVICE_ROLE_KEY` fuera de `api/_lib` | **NO EXISTE** | — | 1 (test) |
| API-11 | Validación Zod ausente en la mayoría de endpoints | **EXISTE** | Alta | 1 |
| DB-01 | Rate limiting en BD (`comments`, `sightings`, `publications`, …) | **NO EXISTE** | Alta | 2 |
| DB-02 | Funciones `SECURITY DEFINER` sin `pg_temp` en `search_path` | **PARCIAL** | Baja | 2 |
| DB-03 | `REVOKE EXECUTE` para funciones expuestas a `anon` | **NO EXISTE** | Media | 2 |
| DB-04 | Difuminado de ubicación con `random()`: promediable | **EXISTE** | **Alta** | 2 |
| DB-05 | `locations` SELECT público + UPDATE abierto a cualquier autenticado | **EXISTE** | **Alta** | 2 |
| DB-06 | `contact_phone/whatsapp/email` legibles por `anon` sin límite ni log | **EXISTE** | **Alta** | 2 |
| DB-07 | Grants por columna para datos sensibles | **NO EXISTE** | Media | 2 |
| DB-08 | Políticas RLS `using(true)` sin cláusula `TO` | **EXISTE** | **Alta** | 2 |
| DB-09 | RLS faltante en alguna tabla | **NO EXISTE** | — | — |
| DB-10 | Storage: sobrescritura de objetos ajenos vía upsert | **NO EXISTE** | — | — |
| DB-11 | Buckets de Storage públicos (listado anónimo) | **EXISTE** | Media | 2 |
| DB-12 | Suite de tests pgTAP / `supabase/tests/` | **NO EXISTE** | Alta | 2 |
| DB-13 | `supabase/seed.sql` | **NO EXISTE** | Baja | 1 |
| FE-01 | JSON-LD inyectado con `JSON.stringify` sin escapar `<`/`>` | pendiente | Media | 4 |
| FE-02 | `dangerouslySetInnerHTML` / `innerHTML` con datos de usuario | pendiente | Media | 4 |
| FE-03 | Redirección abierta en `/auth/callback` (`next`) | pendiente | Media | 4 |
| FE-04 | Dominio duplicado (`patitas-plataforma-…` vs `patitass.vercel.app`) | pendiente | Media | 4 |
| DEP-03 | `vercel.json` mezcla `routes` (legacy) con `headers` | pendiente | Baja | 4 |
| AI-01 | Proveedor IA por defecto (`TESSERACT`) sin dependencia instalada | **EXISTE** | Alta | 5 |
| AI-02 | `imageResponse` sin definir en el proveedor Cloudflare | **EXISTE** | Media | 0 ✅ |
| AI-03 | Auto-publicación guiada por salida de LLM sobre texto externo | **EXISTE** | Media | 8 |

Los hallazgos de Fase 4 marcados *pendiente* no se verificaron a fondo en la Fase 0
(no era el alcance); la Fase 4 los confirma o descarta uno a uno.

---

## 2. Hallazgos verificados en Fase 0

### DOC-01 — Usuarios semilla con contraseña pública en migraciones → **NO EXISTE**

La auditoría externa pedía crear una migración para borrar cuentas semilla
(`ana@patitas.dev`, `luis@patitas.dev`, `mod@patitas.dev` / `patitas123`, una con
rol `MODERATOR`). **Esas cuentas no existen.**

Evidencia (búsqueda exhaustiva sobre `supabase/`):

| Patrón buscado | Ocurrencias |
|----------------|-------------|
| `insert into auth.users` | 0 |
| `auth.identities` | 0 |
| `encrypted_password` / `crypt(` | 0 |
| `ana@patitas.dev` / `luis@patitas.dev` / `mod@patitas.dev` | 0 |
| `patitas123` | 0 |

Las únicas referencias a `auth.users` son estructurales:
`supabase/migrations/0001_initial_schema.sql:28` (FK `profiles.id → auth.users.id`)
y `:68` (trigger `on_auth_user_created`). `MODERATOR` solo aparece como valor del
enum en `0001:4` y en las comprobaciones de RLS.

**Consecuencia**: no se crea la migración `0011` de borrado. Sería una migración
que no hace nada y que además **no se puede aplicar a migraciones ya congeladas**
(regla 3 del plan).

> ⚠️ **Acción manual igualmente recomendada**: el dueño del proyecto debe
> confirmar en el dashboard de Supabase que no queden esas cuentas creadas a mano.
> Pasos en la sección 5.

### DOC-02 — El README documentaba usuarios semilla inexistentes → **EXISTE** ✅

El problema real no estaba en SQL sino en la documentación.

- `README.md:283` (antes del cambio): *"Si usas Supabase local, las migraciones
  incluyen usuarios de prueba"* — **falso**.
- `README.md:286-292` (antes): publicaba email y contraseña `patitas123`, con un
  usuario `MODERATOR`. Cualquiera que lo leyera podía intentar esas credenciales
  contra producción.

**Corregido en Fase 0**: la sección ahora explica que no existen usuarios semilla
y cómo crear los propios en local, sin credenciales en el README.

**Riesgo residual**: si esas cuentas se crearon manualmente en producción, siguen
ahí. Ver pasos manuales (sección 5.1).

### SEC-01 — Claves expuestas en el historial de git → **NO EXISTE**

Comandos ejecutados sobre todo el historial (`--all`):

```
git log --all -p | Select-String 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
git log --all --oneline -S"service_role" -S"SUPABASE_SERVICE_ROLE_KEY" -S"eyJ"
git log --all --pretty=format: --name-only --diff-filter=A | Select-String '\.env'
```

Resultados:

- **Cero JWT reales.** Los únicos `eyJ...` del repo son placeholders truncados:
  `workers/telegram-collector/.env.example:16` (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`),
  `docs/FUENTES_EXTERNAS.md:43` y `docs/TELEGRAM_SESSION.md:122` (`eyJhbGciOiJ...`).
- **Nunca se versionó un `.env` real.** Los únicos archivos `.env*` que han
  existido en el historial son `.env.example` y
  `workers/telegram-collector/.env.example`.
- `.env` existe en el disco de desarrollo, contiene la service role key real, pero
  está ignorado y **no trackeado**: `git ls-files` solo lista `.env.example`.

**Consecuencia**: no hace falta rotar claves por fuga en git. La Fase 1.5 (rotación)
queda como higiene opcional, no como respuesta a una exposición.

### DEP-01 — 12 vulnerabilidades npm (10 altas) → **EXISTE** ✅

`npm audit` inicial: `{ low: 1, moderate: 1, high: 10, critical: 0, total: 12 }`.
Las 12 colgaban de **una sola dependencia**: `@vercel/node@^20.0.0`
(`undici`, `path-to-regexp`, `ts-morph`, `@ts-morph/common`, `fast-glob`,
`micromatch`, `braces`, `@fastify/busboy`, `ajv`, `@vercel/static-config`,
`esbuild`).

Intento 1: subir a `@vercel/node@^24.0.2` → **el audit no cambió** (su árbol sigue
fijando `undici@5.28.4` y `path-to-regexp@6.1.0`).

**Solución aplicada**: `@vercel/node` se usaba **solo para tipos**
(`import type { VercelRequest, VercelResponse } from '@vercel/node'` en 15 archivos).
Se sustituyó por un shim propio, `api/types/vercel.ts`, y se eliminó la dependencia.

**Resultado**: `npm audit` → `{ total: 0 }`. 100 paquetes menos en `node_modules`.

**Análisis de riesgo del shim** (verificado, no asumido):
- Solo se importaban tipos; el runtime de Vercel no usa el paquete instalado.
- API usada y declarada: `req.method`, `req.query`, `req.headers`, `req.socket`,
  `req.body`, `res.status`, `res.setHeader`, `res.json`. Enumerado con grep sobre
  `api/**` (74 usos de `res.status`, 37 de `req.body`, 27 de `res.setHeader`, 12 de
  `req.method`, 7 de `req.headers`, 3 de `req.socket`, 2 de `req.query`).
- `VercelRequest` extiende `IncomingMessage` y `VercelResponse` extiende
  `ServerResponse` de `node:http`, que es lo que el SDK reexporta.

### DEP-02 — `api/` no estaba en ningún `tsconfig` → **EXISTE** ✅

`tsconfig.json` referenciaba solo `tsconfig.app.json` (`include: ["src"]`) y
`tsconfig.node.json` (`include: ["vite.config.ts", "eslint.config.js"]`).
**Ningún proyecto compilaba `api/`**, así que `npm run build` (`tsc -b`) nunca
verificó ni una línea de backend. Esto es lo que permitió que el bug AI-02
llegara a `main`.

Al añadir `tsconfig.api.json` aparecieron **19 errores de tipos preexistentes**,
todos corregidos en Fase 0 sin cambiar comportamiento:

| Archivo | Problema | Corrección |
|---------|----------|------------|
| `api/_lib/ai-provider.ts:523` | `imageResponse` **no definido** (ReferenceError si se usaba el proveedor Cloudflare para OCR) | añadido `const imageResponse = await fetch(imageUrl)` |
| `api/_lib/ai-provider.ts` (11×) | `implicit any` en callbacks `.map()` y `data` de tipo `unknown` | tipos locales `TesseractWord`, `VisionTextAnnotation`, `VisionLabelAnnotation`, `VisionLocalizedObject`, `CloudflareAIResponse` |
| `api/ingest/external-post.ts:514` | `IngestExternalPostInput` usado sin importar | `type IngestExternalPostInput` añadido al import |
| `api/ingest/external-post.ts:305` | parámetro `images` sin usar | renombrado a `_images` |
| `api/import/facebook-screenshot.ts:115,138` | firma local incompatible con `VisionResult` | parametrizado con `VisionResult` + `?? ''` |
| `api/takedown/index.ts:37-42` | `{}` asignado a un tipo con propiedades requeridas | tipado como `Partial<{...}>` |
| `src/lib/validations/ingest.ts:100` | parámetro `payload` sin usar | `_payload` + `FIXME` (ver API-07) |

`tsconfig.api.json` incluye además los dos módulos de `src/lib/validations/` que
`api/` importa (`facebook-import.ts`, `ingest.ts`), porque un proyecto compuesto
debe listar todos los archivos que consume.

**Nota de higiene**: durante la Fase 0, un reemplazo masivo con
`Get-Content -Raw` (PowerShell 5.1 decodifica como CP1252) provocó doble
codificación en los 15 archivos de `api/`. Se detectó con `git diff`, se revirtió
`api/` desde `HEAD` y se rehizo el cambio con `File.ReadAllText/WriteAllText`
(UTF-8 explícito). Verificado a nivel de punto de código (`ó` = `U+00F3` en HEAD y
en disco) y el diff son 15 líneas de 1 cambio cada una.

---

## 3. Hallazgos verificados para fases siguientes

### API-01 — Moderación: rol y JWT correctos, falta Zod → **PARCIAL** (Fase 1)

Lo que **está bien** (y contradice la sospecha de la auditoría externa):

- El rol se lee de la base de datos con service role, no de claims:
  `api/admin/moderation.ts:48-52` `.from('profiles').select('role').eq('id', userData.user.id)`,
  gate en `:54-55` (`role !== 'MODERATOR' && role !== 'ADMIN'` → 403).
- El JWT se valida correctamente: `api/admin/moderation.ts:42`
  `await supabaseAdmin.auth.getUser(token)`.
- **Cero** usos de `user_metadata` / `app_metadata` / claims en todo `api/`.
- Sí escribe en `audit_logs` en las 6 acciones (`:84`, `:104`, `:131`, `:179`, `:230`).

Lo que **falta**:

- **No hay Zod.** `:58-68` solo comprueba presencia (`!payload.action || !payload.id`).
  `payload.id` nunca se valida como UUID (`:78`, `:98`, `:125`, `:147`).
  No existe campo `reason` con longitud máxima; una acción desconocida cae al
  fallback `:241`.
- El error del `insert` en `audit_logs` se ignora: si falla, la acción se ejecuta
  y **no queda registro**, silenciosamente.

### API-02 — IDOR de lectura en IA → **EXISTE** (Fase 1)

- `api/ai/process-publication.ts:59-61` **sí** comprueba propiedad y devuelve 403
  (aunque no contempla al moderador).
- `api/ai/calculate-matches.ts:52-57` selecciona la publicación **sin**
  `owner_profile_id` y nunca la compara con `user.id`. No hay ningún 403 en el
  archivo. `:106-137` devuelve características y ubicación (provincia/municipio)
  de publicaciones ajenas.
- `api/ai/detect-duplicates.ts:50-70` repite el hueco y además **escribe** en
  `duplicate_detections` (`:125-138`).

### API-03 — `create-match` acepta scores del cliente → **EXISTE** (Fase 1)

- Scores del cliente: `api/ai/create-match.ts:63-69` valida rango 0-100 y `:99-103`
  los inserta (`overall_score: payload.overallScore`, `structured_score: …`).
- **No hay recálculo en servidor**: ninguna llamada a
  `rpc('calculate_structured_match_score')`, pese a que
  `calculate-matches.ts:100` sí la usa.
- **No comprueba propiedad de A o B**: `:82-86` trae `owner_profile_id` y `:88-90`
  solo verifica que existan las dos filas.
- Auto-match **sí** está bloqueado (`:71-73`). Duplicados solo por constraint
  (`:113-117`, código `23505` → 409).

### API-04 — `/api/takedown` permite censura anónima → **EXISTE** (Fase 1) 🔴

- `api/takedown/index.ts:25-35`: la autenticación es **opcional por diseño**
  (comentario explícito) y `:111-116` hace
  `.update({ status: 'HIDDEN' }).eq('id', payload.publication_id)` **sin comprobar
  propiedad**.
- Un anónimo que conozca un UUID de publicación puede ocultarla. El límite de 5/h
  es por IP falsificable (`:21` + `getClientIp`).
- `:79-89` solo evita una segunda solicitud `PENDING`; tras un rechazo se puede
  volver a ocultar.

### API-05 — SSRF → **EXISTE** (Fase 1)

- `api/ai/extract-from-image.ts:44-46` acepta `imageUrl` del cliente y `:52-56` lo
  pasa al proveedor. El proveedor hace `await fetch(imageUrl)` **sin allowlist ni
  bloqueo de IPs privadas**: `api/_lib/ai-provider.ts` (Cloudflare, OCR y
  embedding) y con `GOOGLE_VISION` la URL se envía a Google como `imageUri`.
  Permite alcanzar `http://169.254.169.254/` (metadata de nube) y servicios internos.
- `api/import/facebook-link.ts`: la allowlist (`src/lib/validations/facebook-import.ts:8-41`)
  valida **la URL que envía el usuario** y `:72` usa `redirect: 'manual'` (correcto),
  pero el `og:image` extraído del HTML remoto se propaga a `:156`
  `provider.analyzeImage(metadata.image, …)` sin validar el host.

### API-06 — Rate limiting → **EXISTE** (Fase 2)

- Almacén en memoria por instancia: `api/_lib/rate-limit.ts:10`
  (`globalThis.patitasRateLimit ?? new Map()`). El límite efectivo es
  `límite × nº de instancias`; los buckets caducados nunca se borran.
- **Solo por IP, sin cuota por usuario**: `api/_lib/rate-limit-utils.ts:18-19`
  (`rateKey = ${key}:${ip}`). Además el rate limit corre **antes** de `verifyAuth`
  (p. ej. `process-publication.ts:24` vs `:29`).
- **IP spoofeable**: `rate-limit-utils.ts:5-8` toma `x-forwarded-for[0]`, el valor
  más a la izquierda (controlado por el cliente). No usa `x-real-ip` ni
  `x-vercel-forwarded-for`. Duplicado en `moderation.ts:25-26` y
  `ingest/external-post.ts:64-65`.
- `429` + `Retry-After`: **correcto** (`rate-limit-utils.ts:22-28`).

### API-07 — HMAC de ingesta incompleto → **EXISTE** (Fase 1)

- `api/ingest/external-post.ts:537-544` firma solo
  `source_id`, `platform`, `external_id`, `source_url`, `posted_at`, `timestamp`.
- `raw_text` e `image_paths` **no van firmados**, así que quien capture un sobre
  válido puede alterar el contenido antes de reenviarlo (ventana anti-replay de
  5 min).
- `src/lib/validations/ingest.ts:99-112` `verifyHmacSignature` es un stub que
  devuelve `signature.length >= 64` ignorando payload y secreto. **No se importa
  desde `api/`** (la verificación real está en `external-post.ts:68-91`), pero es
  una función pública con nombre engañoso: marcada con `FIXME` en Fase 0.

### API-08 — Fuga de errores internos → **EXISTE** (Fase 1)

`api/admin/moderation.ts:81, :101, :128` y `api/health.ts:36` devuelven
`error.message` al cliente. `health.ts` es además un endpoint público sin
autenticación.

### API-09 — Comparación de secreto no timing-safe → **EXISTE** (Fase 1)

`api/ai/process-job.ts:26` `if (!apiKey || authHeader !== \`Bearer ${apiKey}\`)`.

### API-10 — `SUPABASE_SERVICE_ROLE_KEY` fuera de `api/_lib` → **NO EXISTE**

Cero ocurrencias en `src/`. Solo en código de servidor:
`api/_lib/supabase-admin.ts:6` y `:9`. El resto son plantillas y documentación.
`src/` tampoco importa nada de `api/`: solo hace `fetch('/api/…')` en 10 puntos.

**Acción Fase 1**: añadir el test/regla ESLint que *mantenga* esta garantía
(el plan lo pide como prevención, no como corrección).

### DB-01 — Rate limiting en la base de datos → **NO EXISTE** (Fase 2)

Ninguna de las 5 tablas tiene trigger de frecuencia:

| Tabla | Triggers existentes |
|-------|---------------------|
| `comments` | solo `comments_set_updated_at` (`0001:272-274`) |
| `sightings` | solo `updated_at` (`0001:263-265`) |
| `publications` | `updated_at` (`0001:257-259`) y FTS (`0008:48-51`) |
| `adoption_requests` | solo `updated_at` (`0001:275-277`) |
| `reports` | solo `updated_at` (`0001:266-268`) |

El único `BEFORE INSERT` del esquema es el fuzzing de `locations`
(`0007:53-56`). **Confirmado**: el rate limit vive solo en `/api`, que es
exactamente el vector que la arquitectura permite saltar con `anon key` + JWT.

### DB-02 — `SECURITY DEFINER` sin `pg_temp` → **PARCIAL** (Fase 2)

Tres funciones, todas con `search_path` fijo y ninguna sin él:

- `public.handle_new_user()` — `0001:43-47`, redefinida en `0004:4-8`
- `public.fuzz_location_on_insert()` — `0007:25-29`
- `public.fuzz_location_on_update()` — `0007:62-66`

Pero usan `set search_path = public`, **sin** `pg_temp` al final. El hardening
recomendado es `set search_path = public, pg_temp`.

Ninguna devuelve columnas sensibles (`handle_new_user` escribe en `profiles`; las
`fuzz_*` solo tocan `NEW.approximate_lat/lng`; `fuzz_coordinates()` devuelve
coordenadas ya difuminadas).

Detalle extra: `fuzz_coordinates()` está declarada `immutable` (`0007:10`) pese a
usar `random()` — volatilidad mal declarada, el planificador puede cachear el
resultado.

### DB-03 — `REVOKE EXECUTE` → **NO EXISTE** (Fase 2)

Cero `GRANT`/`REVOKE` en `supabase/`. Quedan con `EXECUTE` para `PUBLIC` por
defecto: `fuzz_coordinates` (`0007:7`), `search_publications` (`0008:113`),
`search_similar_publications_by_text` (`0010:117`), `search_similar_images`
(`0010:145`), `calculate_structured_match_score` (`0010:176`). Todas son
`SECURITY INVOKER`, así que RLS sigue aplicando y el riesgo es menor, pero el
`REVOKE` explícito es la práctica correcta.

### DB-04 — Fuzzing promediable → **EXISTE** (Fase 2) 🔴

- `0007:16-17` `round((lat + (random() * 0.01 - 0.005))::numeric, 6)`
- `0007:39-40` y `0007:79-80` `new.approximate_lat + (random() * 0.006 - 0.003)`
- Cero `current_setting`/`set_config`: **no hay secreto de BD**.
- El comentario `0007:14` afirma *"Usamos hash del lat/lng como seed para
  consistencia en la misma ubicación"* — **es falso**, no hay hash ni seed.

**Ataque viable**: `difuminado = round(real,3) + U(-0.003, +0.003)`.
`locations` es de lectura pública total (`0001:295`) y cualquier autenticado puede
hacer `UPDATE` (`0001:296-297`), lo que re-dispara el fuzzing (`0007:70-71`).
`n` guardados de las mismas coordenadas son `n` muestras independientes centradas
en el punto real: el error pasa de ±0.003° (~330 m) a `0.003/√(3n)`.
Con `n=50` ≈ ±27 m; con `n=500` ≈ ±8 m.

### DB-05 — `locations` con lectura pública y UPDATE abierto → **EXISTE** (Fase 2)

- `0001:295` `create policy "public locations readable" … for select using (true)`
- `0001:296-297` `for insert/update using (auth.uid() is not null)` — **cualquier
  autenticado puede modificar cualquier ubicación**, no solo la suya.

### DB-06 — Datos de contacto expuestos → **EXISTE** (Fase 2) 🔴

- Columnas: `0001:122` `contact_phone`, `0001:123` `contact_whatsapp`,
  `0001:124` `contact_mode`, `0003:3` `contact_email`.
- Lectura: `0001:311` `create policy "public publications readable" … using
  (deleted_at is null and status in ('ACTIVE','RESOLVED'))` **sin cláusula `TO`**,
  así que aplica a `PUBLIC` (incluye `anon`). RLS es row-level: **todas las
  columnas de la fila son legibles**.
- Cero ocurrencias de `reveal` / `contact_reveal` en el repo: **no hay límite
  diario ni registro** de revelaciones.

Cualquiera con la `anon key` puede descargar teléfonos, WhatsApp y emails de todas
las publicaciones activas en masa.

### DB-07 — Grants por columna → **NO EXISTE** (Fase 2)

Cero `GRANT`/`REVOKE`/`ALTER DEFAULT PRIVILEGES` en `supabase/`. Toda la
protección es RLS de fila.

Dos columnas citadas por el README **no existen**:
`profiles.phone` (los campos de `profiles` son `id, username, full_name,
avatar_url, role, bio, city, country, created_at, updated_at, deleted_at` —
`0001:27-39`) y `locations.exact_lat`/`exact_lng` (solo `approximate_lat/lng` —
`0001:76-77`).

`pets.microchip_private` (`0001:96`, `0003:7`) sí existe y está protegida solo por
la política de fila de `pets` (`0001:299-303`).

### DB-08 — Políticas `using(true)` sin `TO` → **EXISTE** (Fase 2) 🔴

| Política | Ubicación | Efecto |
|----------|-----------|--------|
| `system can insert notifications` | `0005:57-58` | **cualquiera, incluido `anon`**, puede insertar notificaciones para cualquier `profile_id` (spam/phishing) |
| `service role can update source tracking` | `0011:174-175` | el comentario dice service role, pero sin `TO service_role` **cualquiera** puede alterar `is_active`, `is_trusted`, `last_cursor`, `error_count` |
| `takedown_requests` INSERT | `0011:216-217` | `with check (true)`, sin rate limit en BD |

### DB-09 — RLS faltante → **NO EXISTE**

**23/23 tablas** tienen `ENABLE ROW LEVEL SECURITY`:
`0001:279-289` (11), `0009:256-262` (7), `0010:260-261` (2), `0011:143-145` (3).

### DB-10 — Sobrescritura de objetos ajenos → **NO EXISTE**

Un `upsert` exige pasar INSERT **y** UPDATE. En `pet-images`, ambas políticas
exigen propiedad de la publicación (`0006:9-23`, `:27-37`); en `avatars`, que la
primera carpeta sea `auth.uid()` (`0006:71-80`, `:84-90`).

La ausencia de `WITH CHECK` en las políticas `UPDATE` (`0006:27-37`, `:84-90`)
**no** es un hueco: en PostgreSQL, si se omite, el `USING` se usa también como
check de la fila nueva.

### DB-11 — Buckets públicos → **EXISTE** (Fase 2)

`0002:4-5` crea `pet-images` y `avatars` con `public = true`, y el `SELECT` es
abierto (`0002:9-11`, `0002:46-48`): lectura y **listado anónimo** de todos los
objetos, incluidas imágenes de publicaciones ya resueltas o borradas
lógicamente. Límites de tamaño y MIME **sí** existen a nivel de bucket
(`0002:2-6`: 8 MB `pet-images`, 2 MB `avatars`).

### DB-12 — Sin tests pgTAP → **NO EXISTE** (Fase 2)

No existe `supabase/tests/`. Cero ocurrencias de `plan(`/`pgtap`/`has_table` en
`supabase/`. Los únicos tests del repo son Vitest (`package.json`).

### DB-13 — Sin `supabase/seed.sql` → **NO EXISTE** (Fase 1)

No existía (`config.toml` tampoco tenía sección `[db.seed]`, así que
`supabase db reset` no cargaba ningún seed).

Lo más cercano es `scripts/seed-test-publications.mjs` (`npm run seed:test`), que
**no crea usuarios**: reutiliza un perfil existente (`:169-184`) y aborta si no
hay ninguno (`:177-180`); inserta `locations`/`pets`/`publications` con su propio
fuzzing en cliente (`:211-213`, `Math.random()*0.001`).

> **Decisión tomada**: el plan pedía *"mover cualquier seed a `supabase/seed.sql`"*.
> Como **no había ningún seed que mover**, crear uno con usuarios de prueba sería
> introducir precisamente el riesgo que DOC-01 quería eliminar. Se creó
> `supabase/seed.sql` con **solo ubicaciones de referencia** (idempotentes, sin
> credenciales), documentado como exclusivo de local, más un `WARNING` si detecta
> cuentas semilla obsoletas en la base local. Se activó con `[db.seed]` en
> `supabase/config.toml`: `supabase db push` solo aplica `supabase/migrations/`,
> así que el seed nunca llega a producción.

### AI-01 — Proveedor IA por defecto sin dependencia → **EXISTE** (Fase 5)

`.env.example:21` pone `AI_PROVIDER=TESSERACT` por defecto, pero `tesseract.js`
**no está instalado** ni figura en `package.json` (`node_modules/tesseract.js` no
existe). `api/_lib/ai-provider.ts:198` hace `await import('tesseract.js')` en
tiempo de ejecución → el OCR falla en producción con el proveedor por defecto.

`@google-cloud/vision` tampoco está instalado (documentado en
`INSTALAR_DEPENDENCIAS_IA.md` como paso manual).

### AI-02 — `imageResponse` sin definir → **EXISTE** ✅ (corregido en Fase 0)

`api/_lib/ai-provider.ts:523` usaba `imageResponse.arrayBuffer()` sin haberla
definido nunca (la definición sí existe en `analyzeImage`, `:555`, y en
`generateImageEmbedding`, `:617`). Era un `ReferenceError` garantizado al usar el
proveedor Cloudflare para OCR. No se detectó antes **porque `api/` no se
compilaba** (DEP-02).

### AI-03 — Auto-publicación guiada por LLM → **EXISTE** (Fase 8)

`api/ingest/external-post.ts:413-421` decide `shouldAutoPublish` con una
`confidence` derivada de clasificación/extracción del texto externo (`:672-678`).
La única defensa anti prompt-injection es un regex best-effort
(`src/lib/validations/ingest.ts:53-80`). Además `:471` crea publicaciones con
`owner_profile_id: '00000000-…-000000000000'` ("System user") y `:374` inserta el
mismo UUID placeholder en `duplicate_detections`.

---

## 4. Correcciones aplicadas en la Fase 0

| # | Cambio | Archivos |
|---|--------|----------|
| 1 | `@vercel/node` eliminado (12 vulnerabilidades → 0) y sustituido por shim de tipos propio | `api/types/vercel.ts`, 15 archivos de `api/**` |
| 2 | `api/` entra en el build de tipos; 19 errores preexistentes corregidos (incluido el bug `imageResponse`) | `tsconfig.api.json`, `tsconfig.json`, `package.json` |
| 3 | Tipos ambientales para las dependencias opcionales de IA | `api/types/ai-dependencies.d.ts` |
| 4 | `.gitignore`: `*.tsbuildinfo`, `build/`, cobertura, `.vercel`, `supabase/.temp`; `.env.example` desbloqueado explícitamente | `.gitignore` |
| 5 | `tsconfig.*.tsbuildinfo` fuera del índice de git | `git rm --cached` |
| 6 | CI: lint + typecheck + build + test + `npm audit --audit-level=high` | `.github/workflows/ci.yml` |
| 7 | README: URL real del repo, usuarios semilla inexistentes, endpoints reales, estado honesto de rate limiting/ubicación/contacto | `README.md` |
| 8 | `FIXME` en el stub HMAC engañoso | `src/lib/validations/ingest.ts` |
| 9 | `supabase/seed.sql` sin credenciales + `[db.seed]` en config | `supabase/seed.sql`, `supabase/config.toml` |

`LICENSE` (MIT) ya existía y es correcto — se verificó el contenido y la
codificación, sin cambios.

---

## 5. Acciones manuales pendientes (para el responsable del proyecto)

### 5.1 Verificar en Supabase que no existan cuentas semilla

Aunque la auditoría demuestra que **las migraciones no las crean**, pudieron
crearse a mano. En el proyecto de producción:

1. Entrar en https://supabase.com/dashboard y abrir el proyecto de Patitas.
2. **Authentication → Users**. Buscar en el buscador: `ana@patitas.dev`,
   `luis@patitas.dev`, `mod@patitas.dev`.
3. Si aparece alguna: abrir el menú de la fila → **Delete user** (borra en cascada
   el `profiles` asociado por la FK `on delete cascade` de `0001:28`).
4. Comprobar también que no quede ningún perfil huérfano. **SQL Editor**:
   ```sql
   select id, username, role, created_at
   from public.profiles
   where username ilike '%ana%' or username ilike '%luis%' or username ilike '%mod%';
   ```
   Revisar el resultado a mano; borrar solo lo que no sea una cuenta real de usuario.
5. Comprobar que no haya moderadores inesperados:
   ```sql
   select id, username, role, created_at from public.profiles where role <> 'USER';
   ```
   Debe salir solo tu cuenta de administrador.
6. Confirmar además que **no exista** `supabase/seed.sql` en el repo (una PR que lo
   añada debe revisarse: los seeds no deben llegar a producción).

### 5.2 `.env.example` y dominios

- `VITE_SITE_URL=https://patitass.vercel.app` en `.env.example:5` es correcto, pero
  `docs/ESTADO_IMPLEMENTACION.md` sigue citando el dominio antiguo en otros puntos.
  La unificación completa (canonical, OG, Redirect URLs) es la tarea **4.9**.
- No hay que rotar ninguna clave: no hubo exposición en git (SEC-01).

---

## 6. Riesgos aceptados y pendientes

1. **Los tipos del shim `api/types/vercel.ts` son `any` en `body`/`query`.**
   Deliberado: obliga a validar con Zod en lugar de confiar en un casteo. El
   riesgo es que un endpoint olvide validar — **es el caso hoy** (API-11) y lo
   cierra la Fase 1.
2. **`tesseract.js` y `@google-cloud/vision` no están instalados** (AI-01). El
   sistema de IA no funciona con el proveedor por defecto. La Fase 5 decide si se
   completa o se apaga con un feature flag `AI_ENABLED`.
3. **`api/takedown` es explotable hoy** (API-04). Es el hallazgo más grave:
   permite censurar cualquier publicación de forma anónima. **Prioridad 1 de la
   Fase 1.**
4. **Los datos de contacto son descargables en masa** (DB-06). Requiere migración
   nueva (0012+), no se puede arreglar desde `/api`.
5. **Dos migraciones comparten el número `0011`**
   (`0011_external_sources.sql` y `0011_fix_resolve_policy.sql`). `supabase db
   reset` las aplica por orden alfabético, lo cual es determinista pero frágil.
   **No se renombran** (regla 3: no tocar migraciones 0001–0010; renombrar una
   0011 ya aplicada rompería el historial de esquema). Las nuevas migraciones
   empiezan en **0012**.
6. **`api/` no se ejecuta en CI**: el type-check es estático. No hay tests de
   endpoints. La Fase 7 añade Playwright.

---

## 7. Estado tras la Fase 1 (críticos + riesgos pendientes de Fase 0)

La Fase 1 se amplió para cubrir también los riesgos que quedaron abiertos tras la
Fase 0.

### Corregido

| Hallazgo | Sev. | Antes | Cómo se corrigió |
|----------|------|-------|------------------|
| API-04 `takedown` censura anónima | 🔴 Crítica | Un anónimo ocultaba cualquier publicación | Exige sesión; oculta de inmediato solo si eres dueño o moderador; si no, queda `PENDING` para revisión |
| DB-06 contacto legible en masa | 🔴 Alta | `anon` descargaba teléfonos y emails | `REVOKE SELECT (contact_*) FROM anon` + cuota 30/24 h + auditoría en `contact_reveals` |
| DB-04 fuzzing promediable | 🔴 Alta | `random()` en cada guardado | `fuzz_coordinates_deterministic()` con secreto de BD y rejilla de ~1,1 km; idempotente en UPDATE |
| API-06 rate limit evadible | 🔴 Alta | `Map` en memoria + `x-forwarded-for[0]` | Upstash/Vercel KV + `x-real-ip`/`x-vercel-forwarded-for` + cuota por usuario |
| DB-01 sin rate limit en BD | 🔴 Alta | Solo en `/api` (saltable con la anon key) | Triggers `BEFORE INSERT` en 5 tablas con cuota por `auth.uid()` y límite estricto < 24 h |
| API-02 IDOR en IA | 🔴 Alta | Cualquiera leía publicaciones ajenas | `canManagePublication()` en `calculate-matches` y `detect-duplicates` |
| API-03 `create-match` con scores del cliente | 🔴 Alta | Scores inventados, sin comprobar propiedad | Recálculo con `calculate_structured_match_score`, propiedad de A o B, umbral mínimo |
| API-05 SSRF | 🔴 Alta | `fetch(imageUrl)` arbitrario | `url-guard` (DNS + rangos privados + sin redirects); el proveedor recibe bytes, no URLs |
| API-07 HMAC no cubre el contenido | 🔴 Alta | `raw_text`/`image_paths` sin firmar | `canonicalIngestPayload()` firma todo. Además se alineó el formato con el worker: **antes ninguna firma podía validar** |
| DB-08 políticas `using(true)` | 🔴 Alta | Un anónimo insertaba notificaciones | `TO service_role` en notifications, external_sources y takedown_requests |
| DB-14 inserción con autor NULL | 🔴 Alta | Se podía comentar sin cuenta | `with check (autor = auth.uid())` en comments, sightings, reports y pets |
| API-01 moderación sin Zod | 🟠 Media | Solo se comprobaba presencia de campos | Zod con enum cerrado, UUID y `reason` ≤ 500; auditoría obligatoria |
| API-08 fuga de errores | 🟠 Media | `error.message` llegaba al cliente | `internalError()` registra en servidor; el cliente ve un mensaje genérico |
| API-11 validación ausente | 🔴 Alta | 11 endpoints sin validar | Zod en todos los endpoints con body |
| API-09 comparación no timing-safe | 🟡 Baja | `!==` con el secreto | `safeEqual()` con `timingSafeEqual` |
| DB-02 `search_path` sin `pg_temp` | 🟡 Baja | `search_path = public` | `public, pg_temp` en las 3 funciones `SECURITY DEFINER` |
| DB-03 sin `REVOKE EXECUTE` | 🟠 Media | `EXECUTE` para PUBLIC | `REVOKE ALL ... FROM public` + `GRANT` explícito |
| API-10 service role en `src/` | — | No existía | **Con test**: `src/lib/__tests__/secrets.test.ts` falla si reaparece |
| AI-01 proveedor IA sin dependencia | 🟠 Media | `TESSERACT` por defecto, imposible | `providerAvailable()` → 503 accionable; `MOCK` por defecto; `provider_is_real` en las respuestas |
| DB-12 sin tests pgTAP | 🔴 Alta | 0 pruebas | `supabase/tests/0012_db_authority.test.sql` |

### Pendiente para fases siguientes

| Hallazgo | Fase | Nota |
|----------|------|------|
| DB-11 buckets de Storage públicos | 2 | Listado anónimo de imágenes |
| DB-05 `locations` UPDATE abierto | 2 | Mitigado por el fuzzing determinista, pero cualquier autenticado aún edita cualquier fila |
| DB-07 grants por columna (resto) | 2 | Solo se revocaron las de contacto |
| AI-03 auto-publicación guiada por LLM | 8 | El HMAC ya cubre el contenido; falta cola de moderación obligatoria |
| FE-* (frontend y despliegue) | 4 | Sin verificar en profundidad |

### Riesgo residual aceptado conscientemente

`publications.contact_*` sigue siendo legible por **cualquier usuario con cuenta**,
con cuota y registro. Cerrarlo del todo implica mover la lectura a una función
`SECURITY DEFINER` y cambiar el frontend; se difiere a la Fase 2 porque hoy la UI
no muestra esos datos a terceros. La barrera actual (anon bloqueado, 30
revelaciones al día y auditoría) elimina el scraping masivo, que era el riesgo real.
