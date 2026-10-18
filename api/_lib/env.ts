/**
 * Configuración de entorno de las Vercel Functions.
 *
 * Se lee una sola vez y se valida al arrancar la función. Nunca se exponen
 * valores: solo se informa si están presentes o no.
 */

/** URL del proyecto Supabase (servidor). */
export const SUPABASE_URL = process.env.SUPABASE_URL;

/**
 * Clave de servicio. Bypasea RLS: solo puede usarse desde `api/_lib`.
 * Hay un test que falla si aparece en `src/` (ver API-10).
 */
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Secreto compartido con el worker de Telegram para firmar la ingesta. */
export const INGEST_HMAC_SECRET = process.env.INGEST_HMAC_SECRET;

/** Clave para los endpoints internos (cron, workers). */
export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

/** Proveedor de IA activo. `MOCK` devuelve datos de demostración. */
export const AI_PROVIDER = (process.env.AI_PROVIDER ?? 'MOCK').toUpperCase();

/**
 * Feature flag de IA.
 *
 * Por defecto está ACTIVADA para no romper la UI existente, pero:
 *   - cada respuesta incluye `provider_is_real` y un aviso cuando el proveedor
 *     no es real, y
 *   - `providerAvailable()` rechaza con un error accionable los proveedores que
 *     hoy no pueden funcionar.
 *
 * La Fase 5 (tarea 5.4) pone este flag a `false` y oculta en la UI lo que depende
 * de IA mientras el proveedor sea simulado. Se desactiva con `AI_ENABLED=false`.
 */
export const AI_ENABLED = process.env.AI_ENABLED !== 'false';

/**
 * ¿El proveedor configurado puede ejecutarse de verdad?
 *
 * `TESSERACT` requiere `tesseract.js`, que NO está en package.json (hallazgo
 * AI-01): sin esta comprobación el endpoint devolvía un error genérico de
 * importación en tiempo de ejecución. Ahora se responde con un mensaje claro.
 */
export function providerAvailable(): { ok: true } | { ok: false; reason: string } {
  if (AI_PROVIDER === 'TESSERACT') {
    return {
      ok: false,
      reason:
        'El proveedor TESSERACT requiere instalar el paquete "tesseract.js". Usa AI_PROVIDER=MOCK o instala la dependencia.',
    };
  }

  if (AI_PROVIDER === 'OPENAI') {
    return { ok: false, reason: 'El proveedor OPENAI todavía no está implementado.' };
  }

  return { ok: true };
}

/**
 * Upstash Redis (opcional). Sin esto, el rate limit de `/api` cae al
 * almacén en memoria por instancia, que es evadible (ver API-06).
 */
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export const REDIS_CONFIG =
  UPSTASH_URL && UPSTASH_TOKEN ? { url: UPSTASH_URL, token: UPSTASH_TOKEN } : null;

/** Zona horaria de referencia para los mensajes de cuota. */
export const RETENTION_MAX_EVENTS = 5000;

/**
 * Entorno de ejecución de Vercel. En `production` se exige configuración
 * completa; en `preview`/`development` se permite degradar con avisos.
 */
export const VERCEL_ENV = process.env.VERCEL_ENV ?? 'development';
export const IS_PRODUCTION = VERCEL_ENV === 'production';

/**
 * Comprueba que la configuración mínima existe.
 * Devuelve la lista de variables que faltan (vacía si todo está bien).
 */
export function missingServerConfig(): string[] {
  const missing: string[] = [];

  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  return missing;
}

/**
 * ¿El proveedor de IA configurado puede dar resultados reales?
 *
 * `MOCK` devuelve datos inventados y `TESSERACT` requiere una dependencia que
 * no está instalada (hallazgo AI-01). Mientras no haya un proveedor real, la UI
 * no debe presentar sus resultados como reales.
 */
export function aiProviderIsReal(): boolean {
  return AI_ENABLED && (AI_PROVIDER === 'CLOUDFLARE' || AI_PROVIDER === 'OPENAI' || AI_PROVIDER === 'GOOGLE_VISION');
}
