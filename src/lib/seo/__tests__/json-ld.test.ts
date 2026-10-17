import { describe, expect, it } from 'vitest';
import { safeJsonLd } from '../json-ld';

/**
 * Tarea 4.4: el JSON-LD se inyecta con `script.textContent`, así que hoy no es
 * explotable (no reparsea HTML). Pero el escapado es barato y protege el día que
 * alguien lo mueva a una plantilla o a renderizado en servidor.
 *
 * Lo que se comprueba: el resultado sigue siendo JSON válido, equivale al objeto
 * original y no contiene los caracteres que pueden cerrar un `<script>`.
 */
describe('safeJsonLd', () => {
  it('escapa < para que no se pueda cerrar el script', () => {
    const evil = { name: 'Perro </script><script>alert(1)</script>' };
    const json = safeJsonLd(evil);

    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c');
  });

  it('escapa > y &', () => {
    const json = safeJsonLd({ text: 'a > b & c < d' });

    expect(json).not.toContain('>');
    expect(json).not.toContain('<');
    expect(json).not.toMatch(/(?<!\\)&/);
    expect(json).toContain('\\u003e');
    expect(json).toContain('\\u0026');
  });

  it('el resultado sigue siendo JSON válido y equivalente al original', () => {
    const original = {
      '@context': 'https://schema.org',
      '@type': 'Thing',
      name: 'Michi <3 & "amigos"',
      description: 'Perdido en el Vedado — </script> nada',
      nested: { array: [1, 2, 'x > y'] },
    };

    const json = safeJsonLd(original);

    expect(JSON.parse(json)).toEqual(original);
  });

  it('escapa U+2028 y U+2029 (rompen literales de JS, no JSON)', () => {
    const json = safeJsonLd({ text: 'linea1\u2028linea2\u2029fin' });

    expect(json).toContain('\\u2028');
    expect(json).toContain('\\u2029');
  });

  it('no toca las comillas ni los caracteres normales', () => {
    const json = safeJsonLd({ name: 'Patitas', text: 'ñandú, ¿qué tal?' });

    expect(JSON.parse(json)).toEqual({ name: 'Patitas', text: 'ñandú, ¿qué tal?' });
  });

  it('funciona con valores anidados y no muta el original', () => {
    const original = { a: { b: ['<script>', 'ok'] } };
    const json = safeJsonLd(original);

    expect(original.a.b[0]).toBe('<script>');
    expect(JSON.parse(json)).toEqual(original);
  });
});
