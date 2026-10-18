import type { ZodType } from 'zod';
import type { VercelRequest, VercelResponse } from '../types/vercel';
import { IS_PRODUCTION } from './env';

/**
 * Utilidades HTTP compartidas por todos los endpoints.
 *
 * Centralizan tres cosas que antes estaban duplicadas (y mal) en cada archivo:
 * la extracción de la IP, la respuesta JSON y —lo importante— la validación de
 * entrada con Zod y el saneado de los mensajes de error.
 */

/* ─────────────────────────────── Respuestas ─────────────────────────────── */

export function json(res: VercelResponse, statusCode: number, body: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).json(body);
}

/** Códigos estables para que el frontend pueda reaccionar sin mirar textos. */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INTERNAL';

export function fail(
  res: VercelResponse,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>
): void {
  json(res, statusCode, { error: message, code, ...extra });
}

/**
 * Responde 500 sin filtrar detalles internos.
 *
 * Antes varios endpoints devolvían `error.message` de Supabase/Postgres al
 * cliente: eso expone nombres de tablas, columnas y políticas (hallazgo API-08).
 * El detalle se registra en los logs del servidor, que sí son privados.
 */
export function internalError(res: VercelResponse, context: string, error: unknown): void {
  console.error(`[${context}]`, error);

  const detail =
    !IS_PRODUCTION && error instanceof Error ? { debug: error.message } : undefined;

  fail(res, 500, 'INTERNAL', 'Error interno del servidor. Inténtalo de nuevo más tarde.', detail);
}

/* ───────────────────────────── Validación con Zod ───────────────────────── */

/**
 * Parsea el cuerpo de la petición con un schema Zod.
 *
 * Devuelve un resultado discriminado para que cada endpoint decida el status,
 * en vez de repetir try/catch y comprobaciones de presencia a mano.
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: ApiErrorCode; message: string; issues?: unknown };

export function parseBody<T>(req: VercelRequest, schema: ZodType<T>): ParseResult<T> {
  let raw: unknown;

  try {
    raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return { ok: false, status: 400, code: 'INVALID_INPUT', message: 'Cuerpo JSON inválido' };
  }

  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { ok: false, status: 400, code: 'INVALID_INPUT', message: 'Se esperaba un objeto JSON' };
  }

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: issues[0] ? `Dato inválido en "${issues[0].path}": ${issues[0].message}` : 'Datos inválidos',
      issues,
    };
  }

  return { ok: true, data: parsed.data };
}

/* ──────────────────────────────── IP real ──────────────────────────────── */

/**
 * Devuelve la IP del cliente usando SOLO headers que Vercel controla.
 *
 * Antes se leía `x-forwarded-for[0]`, el valor más a la izquierda, que el propio
 * cliente puede inyectar: bastaba enviar `X-Forwarded-For: 1.2.3.4` para tener
 * una cuota nueva en cada petición (hallazgo API-06).
 *
 * Vercel garantiza `x-real-ip` y sobrescribe `x-vercel-forwarded-for`, así que
 * se usan esos. Si ninguno está presente (desarrollo local), se cae al socket.
 */
export function getClientIp(req: VercelRequest): string {
  const header = (name: string): string | undefined => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const realIp = header('x-real-ip');
  if (realIp) return realIp.trim();

  const vercelForwarded = header('x-vercel-forwarded-for');
  if (vercelForwarded) {
    // Vercel lo construye como cadena de proxies; la primera es el cliente.
    return vercelForwarded.split(',')[0]!.trim();
  }

  return req.socket?.remoteAddress ?? 'unknown';
}

/* ──────────────────────────── Autorización ─────────────────────────────── */

export type AuthUser = { id: string };

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; status: number; code: ApiErrorCode; message: string };

export interface SupabaseAdminLike {
  auth: {
    getUser: (
      token: string
    ) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
}

/** Extrae el token Bearer del header Authorization. */
export function extractToken(req: VercelRequest): string | null {
  const authorization = req.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
}

/**
 * Valida el JWT contra Supabase Auth (no decodifica claims localmente).
 * Devolver un `AuthResult` evita que cada endpoint invente su propio 401.
 */
export async function requireAuth(
  req: VercelRequest,
  supabaseAdmin: SupabaseAdminLike
): Promise<AuthResult> {
  const token = extractToken(req);

  if (!token) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Falta el token de autorización' };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Sesión inválida o caducada' };
  }

  return { ok: true, user: { id: data.user.id } };
}

/* ──────────────────────────────── Métodos ──────────────────────────────── */

/** Responde 405 si el método no es el esperado. Devuelve true si ya respondió. */
export function rejectMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowed: string
): boolean {
  if (req.method === allowed) return false;

  res.setHeader('Allow', allowed);
  fail(res, 405, 'INVALID_INPUT', `Método no permitido. Usa ${allowed}.`);
  return true;
}
