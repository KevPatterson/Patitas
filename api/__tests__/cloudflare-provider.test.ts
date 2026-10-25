import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAIProvider, type ImagePayload } from '../_lib/ai-provider';

/**
 * Tests del proveedor de Cloudflare Workers AI.
 *
 * Fijan dos cosas que se rompieron con el cambio de proveedor:
 *   - el modelo de visión (LLaVA 1.5 ya no está en la lista de precios),
 *   - el formato de la imagen (`data:` URL dentro de `messages`, no base64 suelto).
 *
 * No hacen red: `fetch` se sustituye por un mock.
 */

const image: ImagePayload = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff]),
  mimeType: 'image/jpeg',
};

const originalEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
};

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.AI_PROVIDER = 'CLOUDFLARE';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'cuenta-de-prueba';
  process.env.CLOUDFLARE_API_TOKEN = 'token-de-prueba';
});

afterEach(() => {
  vi.unstubAllGlobals();

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('proveedor Cloudflare', () => {
  it('usa Llama 3.2 Vision y envía la imagen como data URL', async () => {
    const fetchMock = mockFetch({
      result: { response: 'El texto en la imagen es: Perro perdido, llama al 55512345' },
      success: true,
    });

    const provider = getAIProvider();
    const result = await provider.extractTextFromImage(image);

    expect(result.text).toBe('Perro perdido, llama al 55512345');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('@cf/meta/llama-3.2-11b-vision-instruct');

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.image).toBe('data:image/jpeg;base64,/9j/');
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.temperature).toBe(0);
  });

  it('devuelve texto vacío cuando el OCR no encuentra nada', async () => {
    mockFetch({ result: { response: 'No hay texto visible' }, success: true });

    const provider = getAIProvider();
    const result = await provider.extractTextFromImage(image);

    expect(result.text).toBe('');
  });

  it('parsea el JSON de visión aunque venga dentro de un bloque markdown', async () => {
    mockFetch({
      result: {
        response:
          '```json\n{"species":"dog","color":"brown","size":"small","sex":"male","age":"puppy","collar":true}\n```',
      },
      success: true,
    });

    const provider = getAIProvider();
    const result = await provider.analyzeImage(image);
    const labels = result.labels.map((label) => label.label.toLowerCase());

    expect(labels).toContain('dog');
    expect(labels).toContain('brown');
    expect(labels).toContain('small');
    expect(labels).toContain('male');
    expect(labels).toContain('puppy');
    expect(labels).toContain('collar');
  });

  it('falla con el detalle cuando Workers AI devuelve success: false', async () => {
    mockFetch({ success: false, errors: [{ message: 'daily neuron limit exceeded' }] });

    const provider = getAIProvider();

    await expect(provider.extractTextFromImage(image)).rejects.toThrow(/daily neuron limit exceeded/);
  });

  it('incluye el estado HTTP en el error', async () => {
    mockFetch({ success: false, errors: [] }, 429);

    const provider = getAIProvider();

    await expect(provider.extractTextFromImage(image)).rejects.toThrow(/429/);
  });
});
