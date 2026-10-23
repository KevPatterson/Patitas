import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { VercelRequest, VercelResponse } from './types/vercel.js';
import { fail, getClientIp, json, rejectMethod } from './_lib/http.js';
import { consumeRateLimit, rateLimitHeaders } from './_lib/rate-limit.js';

/**
 * POST /api/sms-hook — Send SMS Hook de Supabase Auth.
 *
 * Supabase llama a este endpoint cada vez que un usuario pide un OTP por
 * teléfono. El endpoint reenvía el código al gateway de TextBee (un teléfono
 * Android con SIM cubana), porque ningún agregador comercial entrega SMS
 * fiable a +53. Asi el mensaje sale por la red local de verdad y es gratis.
 *
 * Seguridad: el payload viene firmado con la especificación Standard Webhooks
 * (cabeceras webhook-id / webhook-timestamp / webhook-signature). Sin firma
 * valida, cualquier atacante con la URL no podría disparar SMS de pago ni
 * inyectar OTP falsos. Se verifica con node:crypto para no añadir
 * dependencias al runtime de las Functions.
 *
 * Configuración en Supabase: Authentication > Hooks > Send SMS hook, tipo
 * HTTP, apuntando a esta URL. El secreto (`v1,whsec_...`) se guarda en Vercel
 * como SEND_SMS_HOOK_SECRETS.
 */

/* ────────────────────────────── Configuración ───────────────────────────── */

const TEXTBEE_BASE_URL = (process.env.TEXTBEE_BASE_URL ?? 'https://api.textbee.dev/api/v1').replace(/\/$/, '');

const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY;
const TEXTBEE_DEVICE_ID = process.env.TEXTBEE_DEVICE_ID;

/** Los secretos separados por "|" (cada uno "v1,whsec_<base64>"). Ver .env.example. */
const HOOK_SECRETS = (process.env.SEND_SMS_HOOK_SECRETS ?? '')
  .split('|')
  .map((secret) => secret.trim())
  .filter(Boolean);

/** Ventana máxima entre la marca de tiempo y ahora (anti-replay). */
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/** Cuota por número: Supabase ya impone 60 s entre OTP; esto es la segunda barrera. */
const SMS_PER_PHONE_PER_MINUTE = 3;

const SMS_PER_IP_PER_MINUTE = 120;

/* ─────────────────────── Lectura del payload crudo ─────────────────────── */

/**
 * La firma HMAC se calcula sobre los bytes exactos de la petición. Vercel
 * parsea `req.body`, luego hay que releer el flujo para que el string que
 * firmamos sea idéntico al que firmó Supabase: sin esto, la verificación sería
 * un juego de adivar espacios y orden de claves.
 */
async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/* ───────────────── Verificación Standard Webhooks (sin deps) ───────────── */

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function verifyHookSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
): boolean {
  const pick = (name: string): string | undefined => {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const hookId = pick('webhook-id');
  const timestamp = pick('webhook-timestamp');
  const signatureHeader = pick('webhook-signature');

  if (!hookId || !timestamp || !signatureHeader) return false;
  if (HOOK_SECRETS.length === 0) {
    console.error('[sms-hook] falta SEND_SMS_HOOK_SECRETS: no se puede verificar el hook');
    return false;
  }

  const elapsedMs = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (!Number.isFinite(elapsedMs) || elapsedMs > TIMESTAMP_TOLERANCE_MS) return false;

  const signedContent = `${hookId}.${timestamp}.${rawBody}`;

  for (const secret of HOOK_SECRETS) {
    const material = secret.replace(/^v1,whsec_/, '');
    let key: Buffer;
    try {
      key = Buffer.from(material, 'base64');
    } catch {
      continue;
    }
    if (key.length === 0) continue;

    const expected = createHmac('sha256', key).update(signedContent).digest('base64');

    // El header admite varias firmas separadas por espacio (rotación).
    for (const candidate of signatureHeader.split(' ')) {
      const withoutVersion = candidate.replace(/^v1,/, '');
      if (timingSafeEqualStrings(expected, withoutVersion)) return true;
    }
  }

  return false;
}

/* ──────────────────────── Payload y envío a TextBee ────────────────────── */

const hookPayloadSchema = z.object({
  user: z.object({ phone: z.string().min(1) }).passthrough(),
  sms: z.object({ otp: z.string().regex(/^\d{6}$/, 'OTP invalido') }).passthrough(),
});

/**
 * El gateway de TextBee es un teléfono Android con la app instalada que recibe
 * la orden API y envia el SMS por su SIM local. Sin tarjeta, sin coste.
 */
async function sendViaTextBee(phone: string, otp: string): Promise<{ ok: boolean; status?: number; detail?: string }> {
  if (!TEXTBEE_API_KEY || !TEXTBEE_DEVICE_ID) {
    // Faltan credenciales: fallo reintenable para que Supabase reintente cuando
    // la configuración exista (mejor reintento honesto que OTP silenciosamente perdido).
    console.error('[sms-hook] falta TEXTBEE_API_KEY o TEXTBEE_DEVICE_ID en el entorno');
    return { ok: false, status: 503, detail: 'gateway no configurado' };
  }

  // ASCII a propósito: los acentos fuerzan SMS de 16 bits y cobran 2 creditos.
  const message = `Patitas: tu codigo es ${otp}`;

  try {
    const response = await fetch(`${TEXTBEE_BASE_URL}/gateway/devices/${TEXTBEE_DEVICE_ID}/send-sms`, {
      method: 'POST',
      headers: {
        'x-api-key': TEXTBEE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipients: [phone], message }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[sms-hook] textbee respondio', response.status, detail.slice(0, 200));
      return { ok: false, status: response.status, detail };
    }

    await response.text().catch(() => '');
    return { ok: true };
  } catch (error) {
    console.error('[sms-hook] fallo de red llamando a textbee', error);
    return { ok: false, status: 0, detail: 'network error' };
  }
}

/* ───────────────────────────────── Handler ─────────────────────────────── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (rejectMethod(req, res, 'POST')) return;

  const rawBody = await readRawBody(req);
  const headers = req.headers as Record<string, string | string[] | undefined>;

  if (!verifyHookSignature(rawBody, headers)) {
    return fail(res, 401, 'UNAUTHORIZED', 'Firma del hook invalida');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return fail(res, 400, 'INVALID_INPUT', 'Cuerpo JSON invalido');
  }

  const payload = hookPayloadSchema.safeParse(parsed);
  if (!payload.success) {
    return fail(res, 400, 'INVALID_INPUT', 'Payload del hook invalido');
  }

  const { phone } = payload.data.user;
  const { otp } = payload.data.sms;

  // Barrera local: si Supabase Auth y el hook coinciden en redirigir mucho
  // trafico apuntando al mismo numero, el gateway Android (que es hardware
  // fisico) no se agota ni bloquea a Etecsa.
  for (const [scope, subject, limit, windowMs] of [
    ['sms-hook-phone', `phone:${phone}`, SMS_PER_PHONE_PER_MINUTE, 65_000],
    ['sms-hook-ip', `ip:${getClientIp(req)}`, SMS_PER_IP_PER_MINUTE, 60_000],
  ] as const) {
    const result = await consumeRateLimit(scope, subject, limit, windowMs);
    if (!result.allowed) {
      res.setHeader('Retry-After', 'true');
      return json(res, 429, { ...rateLimitHeaders(limit, result), error: 'Demasiadas peticiones', code: 'RATE_LIMITED' });
    }
  }

  const delivery = await sendViaTextBee(phone, otp);
  if (delivery.ok) {
    // Supabase acepta respuesta vacia como exito; no se filtra el OTP por HTTP.
    return json(res, 200, {});
  }

  if (delivery.status === 503 || delivery.status === 0) {
    res.setHeader('Retry-After', 'true');
    return json(res, 503, { error: 'Gateway temporalmente indisponible', code: 'RATE_LIMITED' });
  }

  return fail(res, 500, 'INTERNAL', 'No se pudo entregar el SMS');
}
