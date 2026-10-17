/**
 * Validación de URLs que vienen de datos de usuario.
 *
 * Contexto (Fase 4, tarea 4.5 y 4.6):
 *   - `source_url` de una publicación importada y `sourceUrl` extraído de un post
 *     de Facebook acaban en `href` o en `window.open()`. Un `javascript:` ahí es
 *     XSS directo.
 *   - Los parámetros de redirección (`next`, `redirect`, `returnTo`) son el vector
 *     clásico de open redirect: `next=//evil.com` o `next=https://evil.com` salen
 *     del sitio aunque parezcan rutas.
 */

/** Protocolos permitidos en un enlace externo. */
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Devuelve la URL si es segura para usar en `href`, o `null` si no lo es.
 *
 * Rechaza `javascript:`, `data:`, `vbscript:`, `file:` y cualquier cosa que no
 * sea http/https/mailto/tel.
 */
export function safeLinkUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  if (trimmed.length === 0 || trimmed.length > 2048) return null;

  // `//host` es protocol-relative: el navegador lo resuelve contra el esquema
  // actual y sale del sitio. No es una ruta interna válida ni un enlace externo.
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\')) return null;

  // Atajo: cualquier esquema que no sea de la lista se descarta ANTES de parsear,
  // porque `new URL('javascript:alert(1)')` es válido y habría que comprobarlo
  // igualmente.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!SAFE_LINK_PROTOCOLS.has(parsed.protocol)) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  // Sin esquema: solo se aceptan rutas internas (que empiezan por "/" simple).
  if (trimmed.startsWith('/')) {
    return safeInternalPath(trimmed);
  }

  return null;
}

/**
 * Valida una ruta interna de redirección.
 *
 * Solo se permiten rutas relativas al sitio que empiecen por una única `/`.
 * Se rechazan explícitamente:
 *   - `//evil.com` y `/\evil.com` (URL protocol-relative y su variante con barra),
 *   - cualquier cosa con esquema (`https:`, `javascript:`),
 *   - caracteres de control y barras invertidas,
 *   - rutas que no empiezan por `/`.
 *
 * Devuelve la ruta segura o `fallback` (por defecto `/`).
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = '/'
): string {
  if (!raw) return fallback;

  const path = raw.trim();

  if (path.length === 0 || path.length > 2048) return fallback;

  // Debe empezar por una sola barra.
  if (!path.startsWith('/')) return fallback;
  if (path.startsWith('//')) return fallback;

  // Barra invertida: los navegadores la normalizan a "/" en algunos contextos.
  if (path.includes('\\')) return fallback;

  // Esquema embebido (por ejemplo "/redirect?url=https://evil.com" se permite,
  // pero "/https://evil.com" no tiene sentido como ruta interna).
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback;

  // Caracteres de control (incluye \n, \r, \t): permiten inyectar cabeceras en
  // una redirección. Se comprueban por código en lugar de con una regex de rango
  // de control, que ESLint marca como sospechosa (y con razón: suele indicar un
  // patrón pegado de otro sitio).
  for (const char of path) {
    const code = char.codePointAt(0) ?? 0;

    if (code < 0x20 || code === 0x7f) return fallback;
  }

  return path;
}

export type LinkValidation =
  | { ok: true; href: string }
  | { ok: false; reason: string };

/** Igual que `safeLinkUrl` pero devuelve un diagnóstico, útil en formularios. */
export function validateLink(raw: string | null | undefined): LinkValidation {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, reason: 'La URL está vacía' };
  }

  const safe = safeLinkUrl(raw);

  if (!safe) {
    return {
      ok: false,
      reason: 'Solo se permiten enlaces http, https, mailto o tel, o rutas internas',
    };
  }

  return { ok: true, href: safe };
}

/**
 * Construye un `href` para un teléfono: solo dígitos, `+`, espacios, guiones y
 * paréntesis. Evita que un valor manipulado se convierta en otro esquema.
 */
export function safeTelHref(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const cleaned = phone.replace(/[^\d+\s()-]/g, '').trim();

  if (cleaned.length < 5) return null;

  return `tel:${cleaned.replace(/\s/g, '')}`;
}

/** Construye un `mailto:` solo si el valor parece un email. */
export function safeMailtoHref(email: string | null | undefined): string | null {
  if (!email) return null;

  const cleaned = email.trim();

  // Lista de caracteres cerrada: un `[^\s@]` genérico dejaría pasar cosas como
  // `a@b.com<script>`, que en un `mailto:` acaba en el cliente de correo.
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(cleaned)) return null;

  return `mailto:${cleaned}`;
}
