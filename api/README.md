# API Serverless Functions

Esta carpeta contiene las serverless functions desplegadas en Vercel.

## Estructura Consolidada

El plan Hobby de Vercel permite **12 Serverless Functions por deployment**. Para
mantenerse por debajo, los endpoints se agrupan en routers con `?action=` o
`?resource=`, y la lógica compartida vive en `api/_lib/` (Vercel ignora las rutas
con prefijo `_`, igual que `api/_types/`).

`src/lib/__tests__/api-functions.test.ts` cuenta las funciones con la misma regla
que Vercel y falla si se superan las 12.

### 1. `/api/ai` - Funciones de Inteligencia Artificial

Endpoint unificado para todas las operaciones de IA.

**Uso:** `POST /api/ai?action=<action>`

**Actions disponibles:**
- `calculate-matches` - Calcular coincidencias entre publicaciones
- `create-match` - Crear un match entre dos publicaciones
- `detect-duplicates` - Detectar publicaciones duplicadas
- `extract-from-image` - Extraer datos de una imagen con IA
- `process-publication` - Iniciar procesamiento asíncrono de una publicación
- `process-job` - Procesar un job de IA específico (interno)

**Ejemplo:**
```typescript
const response = await fetch('/api/ai?action=extract-from-image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ image: base64Image })
});
```

### 2. `/api/publications` - Gestión de Publicaciones

Endpoint unificado para operaciones relacionadas con publicaciones.

**Uso:** `POST /api/publications?action=<action>`

**Actions disponibles:**
- `create` - Validar creación de publicación (rate limiting)
- `validate-upload` - Validar subida de imágenes
- `takedown` - Solicitud de retirada de contenido

**Ejemplo:**
```typescript
const response = await fetch('/api/publications?action=validate-upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    publicationId: 'uuid',
    fileSize: 2048000,
    mimeType: 'image/jpeg'
  })
});
```

### 3. `/api/uploads` - Subida de Imágenes

Único camino de escritura en Storage: valida por magic bytes, quita EXIF y aplica
cuota.

**Uso:** `POST /api/uploads?action=<publication-image|avatar|delete-image>`

### 4. `/api/admin` - Administración

Router de las tareas de moderación y verificación de perfiles.

**Uso:** `/api/admin?resource=<moderation|verifications>`

**Resources disponibles:**
- `moderation` (POST) - `resolve-report`, `hide-publication`, `restore-publication`, `set-role`
- `verifications` (GET/POST) - Lista la cola y aprueba o rechaza solicitudes

### 5. `/api/seo` - Respuestas para buscadores y bots

**Uso:** `GET /api/seo?action=<og|sitemap>`

- `og` - HTML con Open Graph y JSON-LD para `/p/:slug` (solo crawlers)
- `sitemap` - Sitemap dinámico (`/sitemap.xml` se reescribe aquí)

### 6. `/api/import` - Importación desde Facebook

**Uso:** `POST /api/import?action=<link|screenshot>`

- `link` - Metadatos Open Graph de un enlace público
- `screenshot` - Datos extraídos de una captura de pantalla

### 7. `/api/ingest/external-post` - Ingesta externa

**Uso:** `POST /api/ingest/external-post` con firma HMAC (`INGEST_HMAC_SECRET`).
Lo consume el worker de Telegram.

### 8. `/api/health` - Health Check

**Uso:** `GET /api/health`

## Folders

- `api/_lib/` - Utilidades compartidas y handlers de los routers
- `api/_types/` - Tipos mínimos de Vercel (no cuenta como función por el prefijo `_`)

## Migración desde Endpoints Antiguos

Los siguientes endpoints han sido consolidados:

| Endpoint Antiguo | Nuevo Endpoint |
|-----------------|----------------|
| `POST /api/ai/calculate-matches` | `POST /api/ai?action=calculate-matches` |
| `POST /api/ai/create-match` | `POST /api/ai?action=create-match` |
| `POST /api/ai/detect-duplicates` | `POST /api/ai?action=detect-duplicates` |
| `POST /api/ai/extract-from-image` | `POST /api/ai?action=extract-from-image` |
| `POST /api/ai/process-publication` | `POST /api/ai?action=process-publication` |
| `POST /api/ai/process-job` | `POST /api/ai?action=process-job` |
| `POST /api/publications/create` | `POST /api/publications?action=create` |
| `POST /api/uploads/validate` | `POST /api/publications?action=validate-upload` |
| `POST /api/takedown` | `POST /api/publications?action=takedown` |
| `POST /api/admin/moderation` | `POST /api/admin?resource=moderation` |
| `GET/POST /api/admin/verifications` | `GET/POST /api/admin?resource=verifications` |
| `GET /api/og` | `GET /api/seo?action=og` |
| `GET /api/sitemap` | `GET /api/seo?action=sitemap` |
| `POST /api/import/facebook-link` | `POST /api/import?action=link` |
| `POST /api/import/facebook-screenshot` | `POST /api/import?action=screenshot` |

Los rewrites de `vercel.json` mantienen `/sitemap.xml` y la ruta de bots
`/p/:slug`, y conservan `/api/og` y `/api/sitemap` como alias.

## Rate Limits

Cada acción tiene su propio rate limit independiente:

| Acción | Límite | Ventana |
|--------|--------|---------|
| `calculate-matches` | 30 | 1 hora |
| `create-match` | 50 | 1 hora |
| `detect-duplicates` | 20 | 1 hora |
| `extract-from-image` | 5 | 1 minuto |
| `process-publication` | 20 | 1 hora |
| `publication-create` | 10 | 1 hora |
| `validate-upload` | 50 | 1 hora |
| `moderation` | 20 | 1 minuto |

## Deployment

Total de serverless functions: **8**

1. `api/ai.ts`
2. `api/publications.ts`
3. `api/uploads.ts`
4. `api/admin.ts`
5. `api/seo.ts`
6. `api/import.ts`
7. `api/ingest/external-post.ts`
8. `api/health.ts`
