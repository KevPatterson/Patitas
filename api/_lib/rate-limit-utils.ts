import { consumeRateLimit } from './rate-limit';
import type { VercelRequest, VercelResponse } from '../types/vercel';

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  return Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown';
}

export function checkRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const ip = getClientIp(req);
  const rateKey = `${key}:${ip}`;
  const rate = consumeRateLimit(rateKey, limit, windowMs);

  if (!rate.allowed) {
    res.setHeader('Retry-After', Math.ceil((rate.resetAt - Date.now()) / 1000).toString());
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', rate.resetAt.toString());
    res.status(429).json({ error: 'Too many requests' });
    return false;
  }

  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', rate.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rate.resetAt.toString());
  return true;
}

export async function verifyAuth(token: string | null | undefined, supabaseAdmin: { auth: { getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }> } }) {
  if (!token) {
    return { user: null, error: 'Missing authorization token' };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return { user: null, error: 'Invalid session' };
  }

  return { user: userData.user, error: null };
}

export function extractToken(req: VercelRequest): string | null {
  const authorization = req.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
}
