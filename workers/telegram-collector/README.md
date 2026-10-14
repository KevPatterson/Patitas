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

Ejecuta este script **una sola vez** localmente para generar la sesión:

```python
# generate_session.py
from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id = TU_API_ID
api_hash = 'TU_API_HASH'

with TelegramClient(StringSession(), api_id, api_hash) as client:
    print(client.session.save())
```

Ejecuta: `python generate_session.py`

Te pedirá:
- Tu número de teléfono (formato internacional: +535XXXXXXXX)
- Código de verificación que recibirás en Telegram
- Contraseña 2FA si la tienes configurada

**La sesión generada es un string largo que DEBES guardar de forma segura.** Nunca la subas al repositorio.

### 3. Variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```env
# Telegram API
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_SESSION_STRING=1BVtsOKoBu... (string largo de la sesión)

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
  ('TELEGRAM', '@canal_mascotas_cuba', 'Mascotas Perdidas Cuba', 'La Habana', true),
  ('TELEGRAM', '@perros_perdidos_havana', 'Perros Perdidos La Habana', 'La Habana', false);
```

- `handle_or_url`: Puede ser `@username` de canal público o `https://t.me/canal`
- `is_trusted`: Solo `true` para fuentes muy confiables (permite auto-publicación si se habilita)

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

El workflow en `.github/workflows/telegram-collector.yml` se ejecuta cada 15 minutos.

Configura los secrets en GitHub:
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION_STRING`
- `INGEST_API_URL`
- `INGEST_HMAC_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

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