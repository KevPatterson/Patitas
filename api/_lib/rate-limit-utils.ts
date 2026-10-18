import type { VercelResponse } from '../types/vercel';
import type { VercelRequest } from '../types/vercel';
import { consumeRateLimit, rateLimitHeaders, type RateLimitResult } from './rate-limit';
import { fail, getClientIp } from './http';

/**
 * Aplicación del rate limit a una petición concreta.
 *
 * Antes cada endpoint llamaba a `checkRateLimit(req, res, key, limit, window)` y
 * la clave la formaba este módulo con la IP. Se cambia por funciones con
 * intención explícita, porque la Fase 1 exige **cuota por usuario además de por
 * IP**:
 *
 *   - `limitByIp`   → protege contra abuso anónimo (fuerza bruta, scraping).
 *   - `limitByUser` → cuota real por cuenta, no se esquiva rotando IPs.
 *
 * Ambas reciben el `subject` ya calculado, así que la decisión queda en cada
 * endpoint y no oculta dentro de una firma que asumía la IP.
 */

export type RateLimitOutcome = {
  ok: boolean;
  headers: Record<string, string>;
};

async function apply(
  res: VercelResponse,
  scope: string,
  subject: string,
  limit: number,
  windowMs: number
): Promise<RateLimitOutcome> {
  const result: RateLimitResult = await consumeRateLimit(scope, subject, limit, windowMs);
  const headers = rateLimitHeaders(limit, result);

  if (result.allowed) {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return { ok: true, headers };
  }

  const retryAfter = String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));

  for (const [k, v] of Object.entries({ ...headers, 'Retry-After': retryAfter })) {
    res.setHeader(k, v);
  }

  fail(res, 429, 'RATE_LIMITED', 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.', {
    retryAfter: Number(retryAfter),
  });

  return { ok: false, headers };
}

/** Cuota por IP. Primera barrera en endpoints anónimos. */
export function limitByIp(
  req: VercelRequest,
  res: VercelResponse,
  scope: string,
  limit: number,
  windowMs: number
): Promise<RateLimitOutcome> {
  return apply(res, scope, `ip:${getClientIp(req)}`, limit, windowMs);
}

/**
 * Cuota por usuario autenticado.
 *
 * Se aplica DESPUÉS de validar el JWT. Antes corría antes de `verifyAuth`, así
 * que todas las peticiones de una IP compartida (una oficina, una universidad)
 * gastaban la misma cuota y, en cambio, rotar de IP daba cuota nueva.
 */
export function limitByUser(
  res: VercelResponse,
  scope: string,
  userId: string,
  limit: number,
  windowMs: number
): Promise<RateLimitOutcome> {
  return apply(res, scope, `user:${userId}`, limit, windowMs);
}

/**
 * Cuota específica de los endpoints de IA.
 *
 * La clave es el usuario y no el endpoint, así que no se puede rotar entre las
 * acciones de IA para multiplicar el presupuesto: es un único cubo compartido.
 */
export const AI_QUOTA = {
  /** Peticiones por usuario cada hora en cualquier endpoint de IA. */
  perHour: 40,
  /** Peticiones caras (OCR/vision sobre imagen) por usuario cada hora. */
  heavyPerHour: 10,
} as const;

export function limitAiByUser(
  res: VercelResponse,
  userId: string,
  heavy = false
): Promise<RateLimitOutcome> {
  return limitByUser(
    res,
    heavy ? 'ai-heavy' : 'ai',
    userId,
    heavy ? AI_QUOTA.heavyPerHour : AI_QUOTA.perHour,
    3600_000
  );
}
