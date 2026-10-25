import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalIngestPayload } from '../_lib/ingest-hmac';

/**
 * La firma HMAC de la ingesta la produce el worker de Python
 * (`workers/telegram-collector/auth.py`) y la verifica este endpoint. Antes de la
 * Fase 1 **no coincidían**:
 *
 *   worker:  f"{timestamp}." + json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
 *   server:  JSON.stringify({...}) sin ordenar y sin el prefijo del timestamp
 *
 * Así que ninguna firma válida podía pasar. Estos tests fijan el formato del
 * lado TypeScript y lo comparan con un vector calculado a mano replicando el
 * código de Python. Si alguien cambia un campo o el orden, falla aquí y no en
 * producción con un 401 imposible de depurar.
 */

const base = {
  source_id: '11111111-1111-4111-8111-111111111111',
  platform: 'TELEGRAM',
  external_id: '4242',
  source_url: 'https://t.me/patitas/4242',
  posted_at: '2026-10-16T15:47:00+00:00',
  timestamp: 1_700_000_000,
};

describe('payload canónico de ingesta (paridad con el worker de Python)', () => {
  it('incluye el prefijo "timestamp." igual que auth.py', () => {
    const message = canonicalIngestPayload({ ...base, raw_text: 'Perro perdido', image_paths: [] });

    expect(message.startsWith(`${base.timestamp}.`)).toBe(true);
  });

  it('ordena las claves alfabéticamente y no deja espacios (sort_keys/separators)', () => {
    const message = canonicalIngestPayload({
      ...base,
      raw_text: 'Perro perdido en Vedado',
      image_paths: ['a/b.jpg'],
    });

    const jsonPart = message.slice(`${base.timestamp}.`.length);

    // `separators=(",", ":")` produce JSON sin espacios ESTRUCTURALES. Los
    // espacios dentro de un valor de texto son legítimos, así que se comprueba
    // que no haya separadores con espacio, no que no haya espacios en absoluto.
    expect(jsonPart).not.toMatch(/":\s/);
    expect(jsonPart).not.toMatch(/,\s"/);
    // Orden esperado: external_id, image_paths, platform, posted_at, raw_text,
    // source_id, source_url.
    expect(jsonPart.indexOf('"external_id"')).toBeLessThan(jsonPart.indexOf('"image_paths"'));
    expect(jsonPart.indexOf('"image_paths"')).toBeLessThan(jsonPart.indexOf('"platform"'));
    expect(jsonPart.indexOf('"platform"')).toBeLessThan(jsonPart.indexOf('"posted_at"'));
    expect(jsonPart.indexOf('"posted_at"')).toBeLessThan(jsonPart.indexOf('"raw_text"'));
    expect(jsonPart.indexOf('"raw_text"')).toBeLessThan(jsonPart.indexOf('"source_id"'));
    expect(jsonPart.indexOf('"source_id"')).toBeLessThan(jsonPart.indexOf('"source_url"'));
  });

  it('coincide exactamente con el vector del worker de Python', () => {
    // Calculado replicando json.dumps(payload, sort_keys=True, separators=(",",":"))
    // con raw_text=None e image_paths=[] (los valores por defecto del modelo).
    const expected =
      '1700000000.{"external_id":"4242","image_paths":[],"platform":"TELEGRAM",' +
      '"posted_at":"2026-10-16T15:47:00+00:00","raw_text":null,' +
      '"source_id":"11111111-1111-4111-8111-111111111111",' +
      '"source_url":"https://t.me/patitas/4242"}';

    const actual = canonicalIngestPayload({
      ...base,
      raw_text: null,
      image_paths: [],
    });

    expect(actual).toBe(expected);
  });

  it('coincide con el vector del worker cuando el texto lleva acentos y emoji', () => {
    // Vector calculado con el auth.py real:
    //   json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    //     .encode("utf-8")
    // Si alguien vuelve a poner ensure_ascii=True (el valor por defecto), el
    // mensaje canónico escapa los caracteres no ASCII como \uXXXX y esta firma
    // deja de coincidir: es el fallo que rompía la ingesta de Telegram.
    const data = {
      ...base,
      raw_text: 'Perrito en adopción — Vedado, La Habana. Escribe a María José 🐾',
      image_paths: ['telegram/abc/1.jpg'],
    };

    const message = canonicalIngestPayload(data);
    const signature = createHmac('sha256', 'test-secret').update(message, 'utf8').digest('hex');

    expect(signature).toBe('84a482e5fdc68d1b336766393b0642b8f364131bf22dc99cc47c28afd1e73621');
    expect(message).toContain('adopción — Vedado');
    expect(message).not.toContain('\\u00f3');
  });

  it('NO firma el timestamp ni la propia firma dentro del JSON', () => {
    const message = canonicalIngestPayload({ ...base, raw_text: 'x', image_paths: [] });
    const jsonPart = message.slice(`${base.timestamp}.`.length);

    expect(Object.keys(JSON.parse(jsonPart))).not.toContain('timestamp');
    expect(Object.keys(JSON.parse(jsonPart))).not.toContain('signature');
  });

  it('cambiar el contenido cambia el mensaje firmado (anti-manipulación)', () => {
    const a = canonicalIngestPayload({ ...base, raw_text: 'Texto original', image_paths: [] });
    const b = canonicalIngestPayload({ ...base, raw_text: 'Texto manipulado', image_paths: [] });

    expect(a).not.toBe(b);
  });

  it('cambiar las imágenes cambia el mensaje firmado', () => {
    const a = canonicalIngestPayload({ ...base, raw_text: 'x', image_paths: ['a.jpg'] });
    const b = canonicalIngestPayload({ ...base, raw_text: 'x', image_paths: ['a.jpg', 'b.jpg'] });

    expect(a).not.toBe(b);
  });
});
