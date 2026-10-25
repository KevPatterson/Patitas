# Generar StringSession de Telegram para el Worker

La **StringSession** es una cadena codificada que contiene la autorización de tu cuenta de Telegram.
Permite al worker conectarse **sin intervención manual** (sin pedir código por SMS/Telegram cada vez).

> ⚠️ **Seguridad**: La StringSession es equivalente a tu contraseña. Trátala como un secreto:
> - NUNCA la commits al repositorio
> - Úsala SOLO en GitHub Actions secrets / variables de entorno del servidor
> - Revócala en https://my.telegram.org/sessions si se filtra

---

## Prerrequisitos

1. **Cuenta de Telegram** (puede ser un bot dedicado o tu cuenta personal)
2. **API ID y API Hash** de https://my.telegram.org/apps
3. **Python 3.11+** instalado localmente

---

## Paso 1: Crear App en my.telegram.org

1. Ve a https://my.telegram.org/apps
2. Inicia sesión con tu número de teléfono
3. Completa el formulario:
   - **App title**: `Patitas Worker` (o como prefieras)
   - **Short name**: `patitas-worker`
   - **Platform**: `Desktop`
   - **Description**: `Worker para colectar posts de canales públicos de mascotas`
4. Haz clic en **Create application**
5. Copia **api_id** (entero) y **api_hash** (string)

---

## Paso 2: Generar StringSession localmente

El script `workers/telegram-collector/generate_session.py` lee **solo variables de
entorno** (o el `.env` local, ignorado por git). No hay credenciales en el código.

### Opción A: Script del repositorio (recomendado)

```bash
cd workers/telegram-collector
pip install -r requirements.txt

# TELEGRAM_API_ID y TELEGRAM_API_HASH deben estar en el entorno o en .env
python generate_session.py

# Opcional: guardar la sesión directamente en el .env local
python generate_session.py --write-env

# Opcional: validar la sesión existente sin conectarse
python generate_session.py --check
```

Si defines `TELEGRAM_PHONE`, Telethon no pedirá el número por consola. Siempre
pedirá el código de verificación (y la contraseña 2FA si la cuenta la tiene).

### Opción B: One-liner sin credenciales en el código

```bash
python -c "
import os
from telethon.sync import TelegramClient
from telethon.sessions import StringSession
with TelegramClient(StringSession(), int(os.environ['TELEGRAM_API_ID']), os.environ['TELEGRAM_API_HASH']) as c:
    c.start()
    print(c.session.save())
"
```

---

## Paso 3: Configurar en GitHub Actions

1. Ve a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Agrega los siguientes **Repository secrets**:

| Secret | Valor | Descripción |
|--------|-------|-------------|
| `TELEGRAM_API_ID` | `1234567` | Entero de my.telegram.org |
| `TELEGRAM_API_HASH` | `abcdef123456...` | String de my.telegram.org |
| `TELEGRAM_STRING_SESSION` | `1AgAOMTQ5LjE1...` | **La cadena completa** del paso 2 |
| `SUPABASE_URL` | `https://xxx.supabase.co` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJ...` | Service Role Key (Settings → API) |
| `INGEST_API_URL` | `https://tu-dominio.vercel.app/api/ingest/external-post` | Endpoint completo |
| `INGEST_HMAC_SECRET` | `clave-secreta-larga-aleatoria` | **Igual que en Vercel** (ver abajo) |

> 💡 Genera `INGEST_HMAC_SECRET` con: `openssl rand -hex 32`

---

## Paso 4: Configurar en Vercel (endpoint de ingesta)

En Vercel Dashboard → tu proyecto → **Settings** → **Environment Variables**:

| Variable | Valor | Entorno |
|----------|-------|---------|
| `INGEST_HMAC_SECRET` | *la misma clave de arriba* | Production, Preview |
| `INGEST_AUTOPUBLISH` | `false` | Production, Preview |
| `AUTOPUBLISH_CONFIDENCE_THRESHOLD` | `0.85` | Production, Preview |
| `INGEST_SYSTEM_PROFILE_ID` | *id de un perfil real* | Production, Preview |

`INGEST_SYSTEM_PROFILE_ID` es el perfil al que se atribuyen las importaciones.
Si se omite, se usa el primer perfil con rol `ADMIN`.

---

## Paso 5: Agregar fuentes en la base de datos

Ejecuta en Supabase SQL Editor (usa canales/grupos **públicos y activos**; los
handles de ejemplo no existen):

```sql
INSERT INTO public.external_sources (platform, handle_or_url, name, province, is_trusted)
VALUES
  ('TELEGRAM', '@canal_real_1', 'Nombre real del canal', 'La Habana', false),
  ('TELEGRAM', '@canal_real_2', 'Nombre real del canal', null, true)
ON CONFLICT (platform, handle_or_url) DO NOTHING;
```

- `handle_or_url`: username público real (`@usuario` o `https://t.me/usuario`)
- `is_trusted`: `true` solo para fuentes verificadas (permite auto-publicación si se habilita)
- El worker ignora avisos con más de `MAX_POST_AGE_DAYS` días (30 por defecto) y
  mensajes sin foto (`REQUIRE_IMAGE=true`).

---

## Verificar que funciona

### Ejecución manual local

```bash
cd workers/telegram-collector
cp .env.example .env  # Editar con tus valores
pip install -r requirements.txt
python -m main
```

Deberías ver logs JSON como:
```json
{"timestamp":"2026-10-12T15:30:00.123Z","level":"info","event":"worker_starting","version":"1.0.0"}
{"timestamp":"2026-10-12T15:30:01.456Z","level":"info","event":"telethon_connected","user_id":123456789,"username":"patitas_worker"}
{"timestamp":"2026-10-12T15:30:02.789Z","level":"info","event":"fetched_active_sources","count":3}
{"timestamp":"2026-10-12T15:30:05.123Z","level":"info","event":"source_processing_start","source_id":"uuid...","handle":"@mascotas_perdidas_habana","last_cursor":"12345"}
{"timestamp":"2026-10-12T15:30:08.456Z","level":"info","event":"ingest_success","external_post_id":"uuid...","status":"PENDING_REVIEW","confidence":0.72}
```

### Ver en GitHub Actions

1. Ve a **Actions** → **Telegram Collector Worker**
2. Ejecuta **Run workflow** manualmente
3. Revisa logs: deben aparecer `ingest_success` por cada mensaje nuevo

---

## Solución de problemas

| Error | Causa | Solución |
|-------|-------|----------|
| `SESSION_REVOKED` | Sesión revocada en my.telegram.org | Regenerar StringSession (paso 2) |
| `FLOOD_WAIT_Xs` | Demasiadas requests | El worker espera automáticamente; baja frecuencia del cron |
| `CHANNEL_PRIVATE` | Canal no es público | Solo usa canales/grupos **públicos** (tienen @username) |
| `HMAC inválido` | Secrets no coinciden | Verifica `INGEST_HMAC_SECRET` idéntico en GitHub y Vercel |
| `Storage upload failed` | Bucket no existe / políticas | Crea bucket `external-imports` en Supabase Storage |

---

## Revocar sesión comprometida

Si crees que la StringSession se filtró:

1. Ve a https://my.telegram.org/sessions
2. Inicia sesión
3. Busca "Patitas Worker" o la sesión desconocida
4. Haz clic en **Terminate** / **Revoke**
5. Genera una nueva (paso 2) y actualiza el secret en GitHub

---

## Referencias

- [Telethon StringSession docs](https://docs.telethon.dev/en/stable/basic/session-files.html#string-session)
- [my.telegram.org/apps](https://my.telegram.org/apps)
- [my.telegram.org/sessions](https://my.telegram.org/sessions)