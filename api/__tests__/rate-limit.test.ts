import { describe, expect, it } from 'vitest';
import { consumeRateLimit, rateLimitHeaders } from '../_lib/rate-limit';
import { safeEqual } from '../_lib/authz';

/**
 * Hallazgo API-06: el rate limit vivía en un `Map` de `globalThis` con la IP
 * tomada de `x-forwarded-for[0]` (falsificable), sin cuota por usuario y sin
 * limpiar nunca los buckets caducados.
 *
 * En tests no hay `UPSTASH_REDIS_REST_URL`, así que se ejerce el backend en
 * memoria: es el que se usa en desarrollo y el fallback cuando Redis falla. Lo
 * que se verifica aquí es la semántica del contador (límite, ventana, sujeto),
 * que es común a los dos backends.
 */

describe('consumeRateLimit (backend en memoria)', () => {
  it('permite hasta el límite y luego bloquea', async () => {
    const scope = `test-limit-${Math.random()}`;

    const first = await consumeRateLimit(scope, 'user:a', 2, 60_000);
    const second = await consumeRateLimit(scope, 'user:a', 2, 60_000);
    const third = await consumeRateLimit(scope, 'user:a', 2, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('lleva la cuenta restante', async () => {
    const scope = `test-remaining-${Math.random()}`;

    const result = await consumeRateLimit(scope, 'user:a', 5, 60_000);

    expect(result.remaining).toBe(4);
    expect(result.backend).toBe('memory');
  });

  it('separa cuotas por sujeto (usuario distinto = cuota distinta)', async () => {
    const scope = `test-subject-${Math.random()}`;

    await consumeRateLimit(scope, 'user:a', 1, 60_000);
    const otherUser = await consumeRateLimit(scope, 'user:b', 1, 60_000);

    expect(otherUser.allowed).toBe(true);
  });

  it('separa cuotas por scope (endpoint distinto = cuota distinta)', async () => {
    const user = `user:${Math.random()}`;

    await consumeRateLimit('scope-one', user, 1, 60_000);
    const otherScope = await consumeRateLimit('scope-two', user, 1, 60_000);

    expect(otherScope.allowed).toBe(true);
  });

  it('reinicia la cuota al expirar la ventana', async () => {
    const scope = `test-window-${Math.random()}`;

    await consumeRateLimit(scope, 'user:a', 1, 5);
    expect((await consumeRateLimit(scope, 'user:a', 1, 5)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect((await consumeRateLimit(scope, 'user:a', 1, 5)).allowed).toBe(true);
  });

  it('expone cabeceras estándar de cuota', async () => {
    const scope = `test-headers-${Math.random()}`;
    const result = await consumeRateLimit(scope, 'user:a', 10, 60_000);
    const headers = rateLimitHeaders(10, result);

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('9');
    expect(headers['X-RateLimit-Backend']).toBe('memory');
    expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(0);
  });
});

describe('safeEqual (comparación de secretos en tiempo constante)', () => {
  it('devuelve true para cadenas idénticas', () => {
    expect(safeEqual('Bearer secreto-largo', 'Bearer secreto-largo')).toBe(true);
  });

  it('devuelve false para cadenas distintas de la misma longitud', () => {
    expect(safeEqual('Bearer secreto-largo', 'Bearer secreto-largX')).toBe(false);
  });

  it('devuelve false para longitudes distintas sin lanzar excepción', () => {
    expect(safeEqual('corto', 'mucho-mas-largo')).toBe(false);
    expect(safeEqual('', 'algo')).toBe(false);
  });

  it('es compatible con el header Authorization de la API interna', () => {
    const apiKey = 'clave-interna-de-prueba';
    expect(safeEqual(`Bearer ${apiKey}`, `Bearer ${apiKey}`)).toBe(true);
    expect(safeEqual(`Bearer ${apiKey}`, `Bearer otra-cosa`)).toBe(false);
  });
});
