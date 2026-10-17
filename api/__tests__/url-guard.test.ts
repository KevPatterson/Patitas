import { describe, expect, it } from 'vitest';
import { assertSafeRemoteUrl, isBlockedIp, fetchRemoteImage } from '../_lib/url-guard';

/**
 * Hallazgo API-05: SSRF. `extract-from-image` aceptaba cualquier URL y el
 * proveedor hacía `fetch(imageUrl)`, así que se podía alcanzar
 * `http://169.254.169.254/` (metadatos de nube, que entregan credenciales
 * temporales) o cualquier servicio interno. `facebook-link` repetía el problema
 * con el `og:image` extraído de HTML de terceros.
 *
 * Estos tests fijan el comportamiento del guard. No hacen red: las IPs literales
 * se validan sin DNS y los casos con nombre de dominio se resuelven localmente
 * (`localhost`) o fallan rápido.
 */

describe('isBlockedIp', () => {
  it('bloquea loopback, privadas, link-local y metadatos', () => {
    const blocked = [
      '127.0.0.1',
      '127.1.2.3',
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // metadatos de AWS/GCP
      '100.64.0.1', // CGNAT
      '0.0.0.0',
      '224.0.0.1', // multicast
      '::1',
      'fe80::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ];

    for (const ip of blocked) {
      expect(isBlockedIp(ip), `${ip} debería estar bloqueada`).toBe(true);
    }
  });

  it('permite IPs públicas', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('1.1.1.1')).toBe(false);
    expect(isBlockedIp('2001:4860:4860::8888')).toBe(false);
  });

  it('bloquea lo que no es una IP válida', () => {
    expect(isBlockedIp('no-es-una-ip')).toBe(true);
  });
});

describe('assertSafeRemoteUrl', () => {
  it('rechaza esquemas peligrosos', async () => {
    const urls = [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'gopher://127.0.0.1:6379/_INFO',
      'ftp://example.com/x.jpg',
    ];

    for (const url of urls) {
      const result = await assertSafeRemoteUrl(url);
      expect(result.ok, `${url} debería rechazarse`).toBe(false);
    }
  });

  it('rechaza IPs privadas y de metadatos', async () => {
    const urls = [
      'http://127.0.0.1/x.jpg',
      'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
      'http://10.0.0.5/internal',
      'http://192.168.0.1/router',
      'http://172.16.0.1/admin',
      'http://[::1]/x.jpg',
    ];

    for (const url of urls) {
      const result = await assertSafeRemoteUrl(url);
      expect(result.ok, `${url} debería rechazarse`).toBe(false);
    }
  });

  it('rechaza localhost y dominios internos', async () => {
    for (const url of ['http://localhost:54321/x', 'http://api.internal/x', 'http://foo.localhost/x']) {
      const result = await assertSafeRemoteUrl(url);
      expect(result.ok, `${url} debería rechazarse`).toBe(false);
    }
  });

  it('permite una IP pública literal sin hacer DNS', async () => {
    const result = await assertSafeRemoteUrl('https://8.8.8.8/imagen.jpg');
    expect(result.ok).toBe(true);
  });

  it('rechaza una URL mal formada', async () => {
    const result = await assertSafeRemoteUrl('no-es-una-url');
    expect(result.ok).toBe(false);
  });

  it('respeta la allowlist de dominios cuando se indica', async () => {
    const notAllowed = await assertSafeRemoteUrl('https://ejemplo.com/x', {
      allowedDomains: ['openstreetmap.org'],
    });
    expect(notAllowed.ok).toBe(false);

    const allowed = await assertSafeRemoteUrl('https://8.8.8.8/x', {
      allowedDomains: [],
    });
    expect(allowed.ok).toBe(true);
  });

  it('acepta hosts propios declarados como de confianza', async () => {
    const result = await assertSafeRemoteUrl('https://storage.interno/x.jpg', {
      trustedHosts: ['storage.interno'],
    });
    expect(result.ok).toBe(true);
  });
});

describe('fetchRemoteImage', () => {
  it('no descarga nada si la URL no pasa el guard', async () => {
    const result = await fetchRemoteImage('http://169.254.169.254/latest/meta-data/');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('no está permitido');
    }
  });

  it('no descarga URLs de esquemas no http', async () => {
    const result = await fetchRemoteImage('file:///etc/passwd');
    expect(result.ok).toBe(false);
  });
});
