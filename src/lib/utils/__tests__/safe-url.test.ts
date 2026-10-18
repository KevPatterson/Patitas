import { describe, expect, it } from 'vitest';
import {
  safeInternalPath,
  safeLinkUrl,
  safeMailtoHref,
  safeTelHref,
  validateLink,
} from '../safe-url';

/**
 * Tareas 4.5 y 4.6.
 *
 * 4.5: `source_url` y `sourceUrl` (datos de usuario o de un tercero) acaban en
 * `href` y en `window.open()`. Un `javascript:` ahí es XSS.
 *
 * 4.6: los parámetros de redirección deben aceptar solo rutas internas; `//host`
 * y `https://host` son open redirect.
 */
describe('safeLinkUrl', () => {
  it('acepta http y https', () => {
    expect(safeLinkUrl('https://t.me/canal/123')).toBe('https://t.me/canal/123');
    expect(safeLinkUrl('http://example.com/x')).toBe('http://example.com/x');
  });

  it('acepta mailto y tel', () => {
    expect(safeLinkUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeLinkUrl('tel:+5355555555')).toBe('tel:+5355555555');
  });

  it('RECHAZA javascript:', () => {
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(safeLinkUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeLinkUrl(' javascript:alert(1)')).toBeNull();
  });

  it('RECHAZA data:, vbscript: y file:', () => {
    expect(safeLinkUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeLinkUrl('vbscript:msgbox(1)')).toBeNull();
    expect(safeLinkUrl('file:///etc/passwd')).toBeNull();
  });

  it('RECHAZA vacíos, nulos y URLs demasiado largas', () => {
    expect(safeLinkUrl(null)).toBeNull();
    expect(safeLinkUrl(undefined)).toBeNull();
    expect(safeLinkUrl('')).toBeNull();
    expect(safeLinkUrl('   ')).toBeNull();
    expect(safeLinkUrl(`https://e.com/${'a'.repeat(2100)}`)).toBeNull();
  });

  it('acepta rutas internas y las valida con safeInternalPath', () => {
    expect(safeLinkUrl('/p/mi-mascota')).toBe('/p/mi-mascota');
    expect(safeLinkUrl('//evil.com')).toBeNull();
  });

  it('rechaza texto que no es una URL ni una ruta', () => {
    expect(safeLinkUrl('no es una url')).toBeNull();
  });
});

describe('safeInternalPath (open redirect)', () => {
  it('acepta rutas internas simples', () => {
    expect(safeInternalPath('/')).toBe('/');
    expect(safeInternalPath('/dashboard')).toBe('/dashboard');
    expect(safeInternalPath('/p/perro-perdido?tab=1#foto')).toBe('/p/perro-perdido?tab=1#foto');
  });

  it('RECHAZA protocol-relative //evil.com', () => {
    expect(safeInternalPath('//evil.com')).toBe('/');
    expect(safeInternalPath('///evil.com')).toBe('/');
  });

  it('RECHAZA el truco de la barra invertida /\\evil.com', () => {
    expect(safeInternalPath('/\\evil.com')).toBe('/');
    expect(safeInternalPath('\\/evil.com')).toBe('/');
  });

  it('RECHAZA URLs absolutas con esquema', () => {
    expect(safeInternalPath('https://evil.com')).toBe('/');
    expect(safeInternalPath('javascript:alert(1)')).toBe('/');
    expect(safeInternalPath('/https://evil.com')).toBe('/');
  });

  it('RECHAZA rutas que no empiezan por barra', () => {
    expect(safeInternalPath('dashboard')).toBe('/');
    expect(safeInternalPath('../etc/passwd')).toBe('/');
  });

  it('RECHAZA caracteres de control', () => {
    expect(safeInternalPath('/x\nLocation: https://evil.com')).toBe('/');
    expect(safeInternalPath('/x\r\nSet-Cookie: a=b')).toBe('/');
    // Un control al PRINCIPIO o al FINAL lo elimina `trim()`, y lo que queda es
    // una ruta normal: no hay riesgo porque el carácter ya no está.
    expect(safeInternalPath('/x\t')).toBe('/x');
    // Pero si queda en medio, se rechaza.
    expect(safeInternalPath('/x\tY')).toBe('/');
  });

  it('usa el fallback que se le pase', () => {
    expect(safeInternalPath('//evil.com', '/inicio')).toBe('/inicio');
    expect(safeInternalPath(null, '/inicio')).toBe('/inicio');
  });
});

describe('validateLink', () => {
  it('devuelve ok con la URL normalizada', () => {
    const result = validateLink('https://t.me/x');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.href).toBe('https://t.me/x');
  });

  it('explica por qué se rechaza', () => {
    const result = validateLink('javascript:alert(1)');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/http/i);
  });
});

describe('safeTelHref y safeMailtoHref', () => {
  it('limpia un teléfono y lo convierte en tel:', () => {
    expect(safeTelHref('+53 5555 5555')).toBe('tel:+5355555555');
    expect(safeTelHref('(53) 5555-5555')).toBe('tel:(53)5555-5555');
  });

  it('rechaza teléfonos vacíos o con esquemas inyectados', () => {
    expect(safeTelHref(null)).toBeNull();
    expect(safeTelHref('abc')).toBeNull();
    // Los caracteres raros se eliminan, así que no puede colarse un esquema.
    expect(safeTelHref('javascript:alert(1)')).toBeNull();
  });

  it('solo genera mailto con un email válido', () => {
    expect(safeMailtoHref('a@b.com')).toBe('mailto:a@b.com');
    expect(safeMailtoHref('no-es-email')).toBeNull();
    expect(safeMailtoHref('a@b.com<script>')).toBeNull();
  });
});
