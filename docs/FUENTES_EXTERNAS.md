# Fuentes Externas - Patitas

Documentación técnica y legal sobre la ingesta de contenido desde fuentes externas (Telegram, Facebook Público).

## Resumen

Patitas implementa tres módulos para traer casos de mascotas desde fuentes externas:

| Módulo | Fuente | Método | Estado |
|--------|--------|--------|--------|
| **A** | Telegram (canales/grupos públicos) | Worker Python + Telethon (solo lectura) | ✅ Implementado |
| **B** | Facebook (enlace o captura) | UI en publish-page + IA | ✅ Implementado |
| **C** | Facebook Público (adaptador) | Best-effort, solo metadatos OG | ⚠️ Feature flag OFF |

---

## Módulo A: Colector de Telegram

### Qué HACE
- Lee **solo canales y grupos PÚBLICOS** listados en `external_sources`
- Usa `last_cursor` (message_id) para lectura incremental
- Agrupa álbumes (`grouped_id`) y descarga fotos a Supabase Storage
- Maneja `FloodWaitError` con espera y backoff exponencial
- Envía posts a `POST /api/ingest/external-post` autenticado con HMAC
- Idempotencia por `(platform, external_id)`
- Desactiva fuentes tras 5 fallos consecutivos

### Qué NO HACE
- ❌ NO se une a grupos privados
- ❌ NO evade restricciones de acceso
- ❌ NO usa cuentas falsas ni bots automatizados para login
- ❌ NO guarda datos personales del autor original (solo hash para anti-spam)

### Configuración
```bash
# Variables de entorno (solo servidor)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef...
TELEGRAM_STRING_SESSION=1BVtsOKoBu...  # Generar con generate_session.py
INGEST_API_URL=https://patitas.vercel.app/api/ingest/external-post
INGEST_HMAC_SECRET=secret-generado-con-openssl-rand-hex-32
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
```

### Generar StringSession
```bash
cd workers/telegram-collector
pip install -r requirements.txt
python generate_session.py
# Ingresar teléfono, código, 2FA
# Copiar string generado a TELEGRAM_STRING_SESSION
```

### Ejecución Programada
GitHub Actions (`.github/workflows/telegram-collector.yml`):
- Cron: `*/20 * * * *` (cada 20 min)
- Timeout: 15 min
- Secrets requeridos: todas las variables arriba

---

## Módulo B: Importar desde Facebook (UI)

### Qué HACE
- UI con dos pestañas en `/publicar`: "Enlace" y "Captura"
- **Enlace**: Valida URL con allowlist estricta (`facebook.com`, `fb.com`, `fb.watch`)
  - Fetch con `redirect: manual` (no sigue redirecciones - anti-SSRF)
  - Timeout 8s, límite 2MB
  - Extrae metadatos Open Graph (`og:title`, `og:description`, `og:image`)
  - Si no hay datos útiles → sugiere "Subir captura"
- **Captura**: Reutiliza `/api/uploads/validate` + OCR + Vision IA
  - Extrae texto visible + analiza imagen
  - Pre-llena wizard de publicación con confidence por campo
- Usuario revisa, corrige y publica como **SU publicación**
- Rate limiting: 10/hora (enlace), 15/hora (captura)

### Protección SSRF
- Allowlist estricta de hosts permitidos
- Solo HTTPS
- No sigue redirecciones (3xx)
- Timeout corto (8s)
- Límite de tamaño respuesta (2MB)
- User-Agent identificado (`PatitasBot/1.0`)

### Qué NO HACE
- ❌ NO accede a contenido privado (requiere login)
- ❌ NO salta muros de autenticación
- ❌ NO usa cookies ni sesiones
- ❌ NO resuelve captchas

---

## Módulo C: Adaptador Facebook Público

### Qué HACE
- Interfaz `SourceAdapter` genérica
- Implementación `FacebookPublicAdapter`
- Lee **solo metadatos Open Graph públicos** de una URL
- Feature flag `FACEBOOK_ADAPTER_ENABLED=false` por defecto
- Si Facebook bloquea → retorna `[]` (degrada graciosamente)
- No usa login, no resuelve captchas, no rota proxies

### Qué NO HACE (PROHIBIDO)
- ❌ Cuentas falsas / automatizar login
- ❌ Resolver/evadir captchas
- ❌ Rotación de proxies para evadir bloqueos
- ❌ Ignorar `robots.txt` o límites de rate
- ❌ Scraping masivo o programado sin control
- ❌ Guardar datos personales del autor

### Uso (cuando se habilite)
```typescript
import { getAdapter } from '@/lib/adapters';

const adapter = getAdapter('FACEBOOK_PUBLIC');
if (adapter && adapter.enabled) {
  const posts = await adapter.fetchPublic(sourceConfig, lastCursor);
  // Procesar posts...
}
```

### Arquitectura: Interfaz SourceAdapter

El adaptador sigue el patrón **Strategy** para permitir múltiples fuentes:

```typescript
// src/lib/adapters/source-adapter.ts
interface SourceAdapter {
  readonly name: string;
  readonly platform: 'TELEGRAM' | 'FACEBOOK_PUBLIC';
  readonly enabled: boolean;

  fetchPublic(source: SourceConfig, lastCursor: string | null): Promise<FetchResult>;
  checkHealth(source: SourceConfig): Promise<boolean>;
}

interface SourceConfig {
  id: string;
  platform: ExternalPlatform;
  handle_or_url: string;
  name: string | null;
  province: string | null;
  is_active: boolean;
  is_trusted: boolean;
  last_cursor: string | null;
}

interface FetchResult {
  posts: RawPost[];
  new_cursor: string | null;
  error?: string;
}

interface RawPost {
  external_id: string;
  source_url: string;
  raw_text: string | null;
  image_paths: string[];
  posted_at: string;
  extracted?: Record<string, unknown>;
}
```

### Implementación: FacebookPublicAdapter

```typescript
// src/lib/adapters/facebook-public-adapter.ts
class FacebookPublicAdapter implements SourceAdapter {
  readonly name = 'FacebookPublicAdapter';
  readonly platform = 'FACEBOOK_PUBLIC';
  readonly enabled = import.meta.env.VITE_FACEBOOK_ADAPTER_ENABLED === 'true';

  async fetchPublic(source: SourceConfig, lastCursor: string | null): Promise<FetchResult> {
    if (!this.enabled) {
      return { posts: [], new_cursor: lastCursor, error: 'Adapter disabled by feature flag' };
    }
    // 1. Validar URL con allowlist estricta
    // 2. Fetch con timeout 8s, límite 2MB, sin redirecciones
    // 3. Extraer metadatos Open Graph
    // 4. Retornar posts normalizados
    return { posts: [], new_cursor: lastCursor }; // Best-effort
  }

  async checkHealth(source: SourceConfig): Promise<boolean> {
    // Verificar que la URL responde
    return true;
  }
}
```

### Registro y uso

```typescript
// src/lib/adapters/index.ts
export { SourceAdapter, facebookPublicAdapter, fetchFacebookPublicPosts } from './adapters';

// En admin panel o worker programado:
import { facebookPublicAdapter } from '@/lib/adapters';

if (facebookPublicAdapter.enabled) {
  const result = await facebookPublicAdapter.fetchPublic(sourceConfig, lastCursor);
  for (const post of result.posts) {
    await ingestPost(post); // POST /api/ingest/external-post
  }
}
```

### Cómo HABILITAR el adaptador

1. **Variable de entorno** (Vercel → Settings → Environment Variables):
   ```
   VITE_FACEBOOK_ADAPTER_ENABLED=true
   ```

2. **Configurar fuente en admin panel** (`/admin` → pestaña "Fuentes"):
   - Plataforma: `FACEBOOK_PUBLIC`
   - Handle/URL: `https://facebook.com/nombre-pagina-publica`
   - Activa: ✅
   - Confiable: ❌ (solo para auto-pub si confidence ≥ 85%)

3. **Verificar funcionamiento**:
   - En `/admin` → pestaña "Métricas" → revisar "Importados hoy"
   - Logs en Vercel Functions para `/api/ingest/external-post`

> ⚠️ **ADVERTENCIA**: El adaptador es **best-effort**. Facebook bloquea scrapers agresivamente.
> - Si falla: feature flag se desactiva automáticamente, flujo cae a "sube captura"
> - No usar en producción sin monitoreo activo
> - Revisar términos de servicio de Facebook antes de habilitar

## Base de Datos

### Tablas Nuevas (Migración 0011)

#### `external_sources`
Catálogo de fuentes monitoreadas.
```sql
platform: 'TELEGRAM' | 'FACEBOOK_PUBLIC'
handle_or_url: '@canal' o 'https://facebook.com/pagina'
is_active: boolean
is_trusted: boolean  -- Para auto-publicación
last_cursor: string   -- Último message_id procesado
error_count: int      -- Fallos consecutivos
```

#### `external_posts`
Posts crudos antes de procesar.
```sql
platform, external_id: UNIQUE
status: 'NEW' | 'PROCESSING' | 'NOT_RELEVANT' | 'DUPLICATE' 
        | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'TAKEN_DOWN'
confidence: 0.0000-1.0000
extracted: jsonb      -- Datos estructurados por IA
publication_id: UUID  -- Nullable, vinculado tras crear publicación
```

#### `takedown_requests`
Solicitudes de retirada (DMCA, privacidad, inexactitud).
```sql
reason: 'COPYRIGHT' | 'PRIVACY' | 'INACCURATE' | 'OTHER'
contact_email: opcional
status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
```

#### `publications` - Nuevas columnas
```sql
is_imported: boolean
source_platform: 'TELEGRAM' | 'FACEBOOK_PUBLIC'
source_url: string        -- Visible públicamente en posts importados
import_review_status: 'AUTO_APPROVED' | 'MANUAL_APPROVED' | 'REJECTED'
```

### RLS (Row Level Security)
- Lectura pública: solo publicaciones activas (`status = 'ACTIVE'`)
- `source_url` visible en posts importados
- `external_posts`: solo owner + moderadores
- `takedown_requests`: anyone can INSERT, owner/moderators can SELECT
- Worker usa `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS)

---

## Pipeline de Ingesta (`/api/ingest/external-post`)

### 1. Validación
- Schema Zod + HMAC (timestamp ±5 min, SHA-256)
- Sanitización de texto (defensa prompt injection)
- Límite: 50k chars, 10 imágenes

### 2. Clasificación IA
- Categorías: `LOST` | `FOUND` | `ADOPTION` | `ABANDONED` | `NOT_RELEVANT`
- Detecta "ya resuelto" → `NOT_RELEVANT`
- Texto externo tratado COMO DATOS, nunca instrucciones

### 3. Extracción Estructurada
- Especie, raza, color, tamaño, sexo, collar, placa
- Ubicación → mapeo a provincias/municipios de Cuba
- Contacto (tel, WhatsApp, email), recompensa, fecha

### 4. Deduplicación
- Contra `duplicate_detections` (imagen/texto/zona)
- Umbral: 75% similitud en campos clave

### 5. Confidence Scoring
```
confidence = 0.30*classification + 0.30*extracción + 0.15*fuente_trusted 
           + 0.15*tiene_imagen + 0.10*tiene_ubicación
```

### 6. Crear Publicación
- Estado: `PENDING_REVIEW` (por defecto)
- Auto-publicación SOLO si:
  - `INGEST_AUTOPUBLISH=true` (kill switch)
  - `confidence >= 0.85`
  - `is_trusted = true`
  - Tiene imagen + ubicación
- Siempre con `source_url` visible

### 7. Auditoría
- `audit_logs`: IMPORT_PENDING_REVIEW | IMPORT_AUTO_PUBLISH | IMPORT_MARKED_RESOLVED

---

## Botón "Retirar esta publicación"

### Flujo
1. Usuario hace clic → Modal con motivos (COPYRIGHT, PRIVACY, INACCURATE, OTHER)
2. POST `/api/publications?action=takedown` (rate limit: 10/hora/IP y 5/hora/usuario, requiere sesión)
3. **Inmediato**: Publicación → `status = 'HIDDEN'` (oculta)
4. Crea `takedown_request` con `status = 'PENDING'`
5. Moderador revisa en `/admin` → **Aprobar** (→ `DELETED`) o **Rechazar** (→ restaura)

### Rate Limiting
- 10 solicitudes/hora por IP y 5/hora por usuario
- Requiere JWT: sin sesión no se crea la solicitud (hallazgo API-04)
- Logs en `audit_logs`

---

## Panel de Moderación (`/admin`)

### Pestañas nuevas
- **Retiradas**: Cola de `takedown_requests` con acciones Aprobar/Rechazar
- **Fuentes**: Gestión de `external_sources` (alta/baja/pausa, último run, errores)

### Métricas en Dashboard
- Retiradas pendientes / aprobadas / rechazadas
- Fuentes activas / inactivas

---

## Privacidad y Derechos

### Atribución Obligatoria
Toda publicación importada muestra:
> **Fuente: [enlace al post original]** (plataforma: Telegram/Facebook)

### Contacto Protegido
- Teléfono extraído → columna con `column-level grants`
- Solo usuarios autenticados ven el teléfono
- Siempre se muestra también `source_url`

### Ubicación
- Fuzzing automático ±500m (trigger existente)
- Coordenadas nunca expuestas al cliente

### Datos del Autor Original
- **NO** se guarda nombre, ID, foto de perfil
- Solo hash anónimo para detectar spam cross-source

---

## Riesgos y Limitaciones

### Facebook (Módulos B y C)
| Riesgo | Mitigación |
|--------|------------|
| Términos de Servicio | Solo metadatos OG públicos; no scraping masivo |
| Fragilidad (cambios HTML) | Degrada graciosamente → sugiere captura |
| Contenido privado inaccesible | Usuario sube captura manual |
| Bloqueo de IP | Feature flag OFF por defecto; timeout corto |
| Derechos de autor (imágenes) | Botón "Retirar" inmediato + atribución visible |

### Telegram (Módulo A)
| Riesgo | Mitigación |
|--------|------------|
| FloodWaitError | Backoff exponencial + espera |
| Canales eliminados | Error count → auto-desactivar tras 5 fallos |
| Contenido duplicado | Deduplicación cross-source |

### General
- **Kill switch**: `INGEST_AUTOPUBLISH=false` por defecto
- **Auditoría completa**: `audit_logs` en cada paso
- **Reversibilidad**: Takedown rechaza → restaura publicación

---

## Variables de Entorno Resumen

### Cliente (VITE_)
| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_FACEBOOK_ADAPTER_ENABLED` | `false` | Habilita adaptador Facebook Público |
| `VITE_INGEST_AUTOPUBLISH` | `false` | Auto-publicación importados |

### Servidor
| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `INGEST_HMAC_SECRET` | Sí | Secreto HMAC (64 chars hex) |
| `INGEST_AUTOPUBLISH` | No | Kill switch auto-publicación |
| `AUTOPUBLISH_CONFIDENCE_THRESHOLD` | No (0.85) | Umbral confidence |
| `AUTOPUBLISH_REQUIRE_TRUSTED_SOURCE` | No (true) | Requiere fuente trusted |
| `AUTOPUBLISH_REQUIRE_IMAGE` | No (true) | Requiere imagen |
| `AUTOPUBLISH_REQUIRE_LOCATION` | No (true) | Requiere ubicación |
| `FACEBOOK_ADAPTER_ENABLED` | No (false) | Feature flag adaptador C |
| `TELEGRAM_API_ID` | Para worker | API ID de my.telegram.org |
| `TELEGRAM_API_HASH` | Para worker | API Hash |
| `TELEGRAM_STRING_SESSION` | Para worker | StringSession generada (alias legacy: `TELEGRAM_SESSION_STRING`) |

---

## Testing

### Tests Requeridos (Vitest)
- Parseo de metadatos OG (HTML válido/inválido)
- Validación SSRF (URLs permitidas/denegadas)
- Verificación HMAC (firma válida/inválida/replay)
- Deduplicación (similitud imagen/texto/zona)
- Umbrales auto-publicación (combinaciones de flags)

```bash
npm run test
```

---

## Checklist de Despliegue

- [ ] Migración 0011 aplicada en Supabase
- [ ] Bucket `external-imports` creado en Storage
- [ ] `INGEST_HMAC_SECRET` generado y configurado en Vercel
- [ ] Worker Telegram: secrets en GitHub Actions
- [ ] Feature flags en `false` (verificar)
- [ ] Rate limits configurados en Vercel
- [ ] Logs de auditoría verificados
- [ ] Botón "Retirar" visible en PublicationCard importadas
- [ ] Panel admin: pestañas "Retiradas" y "Fuentes" funcionales