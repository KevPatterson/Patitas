# Telegram Collector Worker

Worker en Python que lee canales/grupos públicos de Telegram y envía los posts a la API de ingesta de Patitas.

## Requisitos

- Python 3.11+
- Cuenta de Telegram (usuario normal, no bot)
- API ID y API Hash de my.telegram.org

## Configuración

### 1. Obtener credenciales de Telegram API

1. Ve a https://my.telegram.org
2. Inicia sesión con tu número de teléfono
3. Crea una nueva aplicación (App title: "Patitas Collector", Short name: "patitas-collector")
4. Copia `api_id` y `api_hash`

### 2. Generar StringSession

El script `generate_session.py` lee las credenciales de variables de entorno
(o del `.env` local). No hay secretos escritos en el código:

```bash
cd workers/telegram-collector
pip install -r requirements.txt
python generate_session.py            # imprime la sesión
python generate_session.py --check    # valida la sesión existente
```

Te pedirá:
- Tu número de teléfono (o usa `TELEGRAM_PHONE` para evitarlo)
- Código de verificación que recibirás en Telegram
- Contraseña 2FA si la tienes configurada

**La sesión generada es un string largo que DEBES guardar de forma segura.** Nunca la subas al repositorio.

### 3. Variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```env
# Telegram API
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_STRING_SESSION=1BVtsOKoBu... (string largo de la sesión)

# Patitas API
INGEST_API_URL=https://patitas.vercel.app/api/ingest/external-post
INGEST_HMAC_SECRET=tu-secreto-hmac-muy-largo-y-seguro

# Supabase (service role para escribir en BD)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### 4. Configurar fuentes en Supabase

Inserta en la tabla `external_sources`:

```sql
INSERT INTO external_sources (platform, handle_or_url, name, province, is_trusted)
VALUES 
  ('TELEGRAM', '@canal_real_1', 'Nombre real del canal', 'La Habana', true),
  ('TELEGRAM', '@canal_real_2', 'Nombre real del canal', 'La Habana', false);
```

- `handle_or_url`: `@username` real de un canal público o `https://t.me/canal`
- `is_trusted`: solo `true` para fuentes muy confiables (permite auto-publicación si se habilita)
- Solo se importan posts de los últimos `MAX_POST_AGE_DAYS` días (30 por defecto)
  que incluyan al menos una foto (`REQUIRE_IMAGE=true`).

## Ejecución

### Local (desarrollo)

```bash
cd workers/telegram-collector
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus credenciales
python main.py
```

### Producción (GitHub Actions)

El workflow en `.github/workflows/telegram-collector.yml` se ejecuta cada 20 minutos.

Configura los secrets en GitHub:
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_STRING_SESSION`
- `INGEST_API_URL`
- `INGEST_HMAC_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Se acepta también el nombre legacy `TELEGRAM_SESSION_STRING` para la cadena de sesión. El workflow revisa antes de ejecutar que todos existan: si falta alguno, el step `Check required secrets` falla y los lista.

## Comportamiento

- **Lectura incremental**: Usa `last_cursor` (message_id) para leer solo mensajes nuevos
- **Álbumes**: Agrupa mensajes con mismo `grouped_id` y descarga todas las fotos
- **Rate limiting**: Respeta FloodWaitError de Telegram con backoff exponencial
- **Idempotencia**: La API de ingesta rechaza duplicados por `(platform, external_id)`
- **Errores**: Tras 5 fallos consecutivos, la fuente se desactiva automáticamente
- **Logs**: Salida JSON estructurada para observabilidad

## Seguridad

- **Solo canales/grupos PÚBLICOS**: El worker NO se une a grupos privados
- **Sin credenciales en repo**: Todo por variables de entorno / GitHub Secrets
- **HMAC en ingesta**: La API verifica firma para evitar replay attacks
- **Service role solo en server**: Nunca expuesto al cliente

## Solución de problemas

### "El secreto TELEGRAM_STRING_SESSION está vacío o no existe"
GitHub no da error si un secret no existe: lo expande a cadena vacía. Si el step
`Verify Telethon session` muestra `Data center: 0`, la cadena llegó vacía.

1. Genera la cadena: `python generate_session.py` (usa `TELEGRAM_API_ID` y `TELEGRAM_API_HASH` del `.env`)
2. Copia el valor que imprime, sin el prefijo `TELEGRAM_STRING_SESSION=`
3. Guárdalo en GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** con el nombre `TELEGRAM_STRING_SESSION`

### "Session expired" / "Authorization lost"
Regenera la StringSession ejecutando de nuevo `generate_session.py`

### "ChannelPrivateError" / "ChatAdminRequiredError"
El canal/grupo no es público o el usuario no tiene acceso. Verifica que `handle_or_url` sea un canal público accesible sin invitación.

### "FloodWaitError"
Telegram limita peticiones. El worker espera automáticamente. Si persiste, reduce frecuencia del cron.

### Imágenes no se suben
Verifica:
- Bucket `external-imports` existe en Supabase Storage
- Service role key tiene permisos de upload
- Tamaño < 8MB y tipo MIME permitido (jpeg, png, webp)