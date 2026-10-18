import { REDIS_CONFIG } from './env';

/**
 * Rate limiting para las Vercel Functions.
 *
 * Problema original (API-06): el contador vivía en un `Map` de `globalThis`, es
 * decir, en la memoria de UNA instancia de función. Con N instancias calientes el
 * límite real era N × límite, y los buckets caducados nunca se liberaban.
 *
 * Ahora hay dos backends:
 *
 *   - **Upstash Redis / Vercel KV** (`UPSTASH_REDIS_REST_URL` + token, o las
 *     variables `KV_REST_API_*`): contador atómico compartido por todas las
 *     instancias. Es el modo correcto y el único válido en producción.
 *   - **Memoria**: fallback para desarrollo local. Se mantiene, pero se marca en
 *     la respuesta con `X-RateLimit-Backend: memory` para que sea evidente en
 *     producción que falta configuración.
 *
 * La clave incluye el usuario cuando hay sesión, así que hay cuota por usuario
 * además de por IP (lo exige la Fase 1).
 */

export type RateLimitBackend = 'redis' | 'memory';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  backend: RateLimitBackend;
};

type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as typeof globalThis & {
  patitasRateLimit?: Map<string, Bucket>;
};

const memoryStore = globalForRateLimit.patitasRateLimit ?? new Map<string, Bucket>();
globalForRateLimit.patitasRateLimit = memoryStore;

/** Tamaño máximo del almacén en memoria (evita crecer sin límite). */
const MEMORY_MAX_BUCKETS = 5000;

function memoryConsume(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = memoryStore.get(key);

  // Limpieza oportunista de buckets caducados (el código original nunca borraba).
  if (memoryStore.size > MEMORY_MAX_BUCKETS) {
    for (const [k, v] of memoryStore) {
      if (v.resetAt <= now) memoryStore.delete(k);
    }
  }

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, backend: 'memory' };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt, backend: 'memory' };
  }

  bucket.count += 1;
  memoryStore.set(key, bucket);

  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt, backend: 'memory' };
}

/**
 * Incremento atómico en Upstash por REST.
 *
 * Se usa el pipeline `/multi-exec` con `INCR` + `PEXPIRE NX` + `PTTL` en una sola
 * petición: menos round-trips y sin ventana de carrera donde la clave quede sin
 * expiración.
 */
async function redisConsume(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  if (!REDIS_CONFIG) return null;

  const { url, token } = REDIS_CONFIG;

  try {
    const response = await fetch(`${url}/multi-exec`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['PEXPIRE', key, String(windowMs), 'NX'],
        ['PTTL', key],
      ]),
    });

    if (!response.ok) {
      console.error('[rate-limit] Upstash respondió', response.status);
      return null;
    }

    const payload = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(payload[0]?.result);
    const ttl = Number(payload[2]?.result);

    if (!Number.isFinite(count)) return null;

    const resetAt = Date.now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs);

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
      backend: 'redis',
    };
  } catch (error) {
    // Si Redis falla se degrada a memoria en vez de dejar el endpoint abierto.
    console.error('[rate-limit] fallo consultando Upstash, se usa memoria', error);
    return null;
  }
}

/**
 * Consume una unidad de cuota.
 *
 * @param scope   Identificador del grupo (endpoint o acción).
 * @param subject Identificador del sujeto: `user:<uuid>` o `ip:<dirección>`.
 */
export async function consumeRateLimit(
  scope: string,
  subject: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = `patitas:rl:${scope}:${subject}`;

  const fromRedis = await redisConsume(key, limit, windowMs);
  if (fromRedis) return fromRedis;

  return memoryConsume(key, limit, windowMs);
}

/** Cabeceras estándar de cuota para adjuntar a cualquier respuesta. */
export function rateLimitHeaders(limit: number, result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'X-RateLimit-Backend': result.backend,
  };
}
