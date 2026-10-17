import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Guardia anti-SSRF para URLs que vienen del cliente o de HTML remoto.
 *
 * Hallazgo API-05: `extract-from-image` aceptaba cualquier `imageUrl` y el
 * proveedor de IA hacía `await fetch(imageUrl)` sin comprobar el destino. Con
 * eso se puede alcanzar `http://169.254.169.254/` (metadatos de instancia de
 * nube, que entregan credenciales temporales), `http://localhost:54321` o
 * cualquier servicio interno de la red de Vercel.
 *
 * `facebook-link` repetía el problema con el `og:image` extraído del HTML de
 * terceros.
 *
 * Estrategia: allowlist de esquemas y hosts + resolución DNS + bloqueo de
 * rangos privados/reservados. No se sigue ninguna redirección.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Hosts del propio Supabase Storage, añadidos dinámicamente desde el entorno. */
function ownHostlist(): string[] {
  const list: string[] = [];
  const supabaseUrl = process.env.SUPABASE_URL;
  const publicUrl = process.env.VITE_SUPABASE_URL;

  for (const candidate of [supabaseUrl, publicUrl]) {
    if (!candidate) continue;
    try {
      list.push(new URL(candidate).hostname.toLowerCase());
    } catch {
      // URL mal formada en el entorno: se ignora.
    }
  }

  return list;
}

/** Rangos privados, loopback, link-local, CGNAT y metadatos de nube. */
function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // no parseable: se bloquea por defecto
  }

  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 (metadatos)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 (IETF)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast y reservado

  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split('%')[0]!; // quita el scope id

  if (normalized === '::' || normalized === '::1') return true; // unspecified y loopback
  if (normalized.startsWith('fe80')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  if (normalized.startsWith('ff')) return true; // multicast
  // IPv4 embebida (::ffff:127.0.0.1)
  if (normalized.startsWith('::ffff:')) {
    return isBlockedIpv4(normalized.slice('::ffff:'.length));
  }

  return false;
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true; // no es una IP válida
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Valida una URL antes de descargarla.
 *
 * @param raw            URL candidata.
 * @param allowedDomains Si se pasa, la URL debe pertenecer a uno de ellos.
 * @param trustedHosts   Hosts de confianza PROPIA (p. ej. el Storage de este
 *                       proyecto) cuyo DNS no hace falta comprobar. Nunca se
 *                       deben poner aquí dominios de terceros.
 */
export async function assertSafeRemoteUrl(
  raw: string,
  options: { allowedDomains?: string[]; trustedHosts?: string[] } = {}
): Promise<UrlCheck> {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'La URL no es válida' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: 'Solo se permiten URLs http o https' };
  }

  const hostname = url.hostname.toLowerCase();

  // Hosts literales que no deben resolverse nunca.
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    return { ok: false, reason: 'Ese destino no está permitido' };
  }

  if (options.allowedDomains && options.allowedDomains.length > 0) {
    const allowed = options.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!allowed) {
      return { ok: false, reason: 'El dominio de la URL no está permitido' };
    }
  }

  // Si ya es una IP literal, se comprueba directamente.
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return { ok: false, reason: 'Ese destino no está permitido' };
    }
    return { ok: true, url };
  }

  const ownHosts = [...ownHostlist(), ...(options.trustedHosts ?? []).map((h) => h.toLowerCase())];

  if (ownHosts.includes(hostname)) {
    return { ok: true, url };
  }

  // Resolución DNS: se bloquean TODAS las direcciones, no solo la primera, para
  // que no sirva un DNS con respuesta mixta (rebinding). Este paso NO se puede
  // omitir para dominios de terceros: es la protección real.
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });

    if (addresses.length === 0) {
      return { ok: false, reason: 'No se pudo resolver el dominio' };
    }

    for (const { address } of addresses) {
      if (isBlockedIp(address)) {
        return { ok: false, reason: 'Ese destino no está permitido' };
      }
    }
  } catch {
    return { ok: false, reason: 'No se pudo resolver el dominio' };
  }

  return { ok: true, url };
}

/**
 * Predicado de tipo en lugar de `if (!check.ok)`.
 *
 * TypeScript solo estrecha una unión por discriminante booleano cuando
 * `strictNullChecks` está activo. Vercel compila `api/` con su propia
 * configuración (no la del proyecto), así que sin `strict` el estrechamiento no
 * ocurre y acceder a `.reason` / `.url` falla. Un predicado de tipo funciona en
 * los dos modos.
 */
function isUrlCheckFailure(check: UrlCheck): check is { ok: false; reason: string } {
  return check.ok === false;
}

/**
 * Descarga una URL remota aplicando el guard y límites de tiempo y tamaño.
 *
 * `redirect: 'manual'` es deliberado: una redirección es la forma clásica de
 * saltarse la validación (se valida un host público que redirige a
 * 169.254.169.254).
 */
export async function fetchRemoteImage(
  rawUrl: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    trustedHosts?: string[];
    allowedDomains?: string[];
  } = {}
): Promise<{ ok: true; bytes: ArrayBuffer; contentType: string } | { ok: false; reason: string }> {
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 8000;

  const check = await assertSafeRemoteUrl(rawUrl, {
    allowedDomains: options.allowedDomains,
    trustedHosts: options.trustedHosts,
  });

  if (isUrlCheckFailure(check)) {
    return { ok: false, reason: check.reason };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(check.url, {
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      return { ok: false, reason: 'La URL remota redirige; no se siguen redirecciones' };
    }

    if (!response.ok) {
      return { ok: false, reason: `El servidor remoto respondió ${response.status}` };
    }

    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (declaredLength > maxBytes) {
      return { ok: false, reason: 'La imagen remota es demasiado grande' };
    }

    const bytes = await response.arrayBuffer();

    if (bytes.byteLength > maxBytes) {
      return { ok: false, reason: 'La imagen remota es demasiado grande' };
    }

    return {
      ok: true,
      bytes,
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { ok: false, reason: aborted ? 'La descarga tardó demasiado' : 'No se pudo descargar la imagen' };
  } finally {
    clearTimeout(timer);
  }
}
