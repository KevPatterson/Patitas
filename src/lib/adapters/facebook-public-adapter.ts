/**
 * Adaptador para Facebook Público.
 * Solo lee metadatos Open Graph de URLs públicas - NO hace scraping de contenido privado.
 * Feature flag: FACEBOOK_ADAPTER_ENABLED (default: false)
 */

import { SourceAdapter, RawPost, SourceConfig, FetchResult } from './source-adapter';
import type { ExternalPlatform } from '../../types/index';

// Feature flag - leer de variables de entorno
const FACEBOOK_ADAPTER_ENABLED = import.meta.env.VITE_FACEBOOK_ADAPTER_ENABLED === 'true';

// Dominios permitidos (allowlist estricta anti-SSRF)
const ALLOWED_HOSTS = [
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'mbasic.facebook.com',
  'fb.com',
  'fb.watch',
  'www.fb.com',
  'l.facebook.com',
  'lm.facebook.com',
] as const;

const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2MB
const USER_AGENT = 'Mozilla/5.0 (compatible; PatitasBot/1.0; +https://patitas.app/bot)';

interface OGMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
}

/**
 * Extrae metadatos Open Graph de HTML.
 * Función pura, sin efectos secundarios.
 */
function _extractOpenGraphMetadata(html: string): OGMetadata {
  const result: OGMetadata = {
    title: null,
    description: null,
    image: null,
    url: null,
  };

  const ogPatterns: Record<keyof OGMetadata, RegExp> = {
    title: /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    description: /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
    image: /<meta\s+property=["']og:image(?::secure_url)?["']\s+content=["']([^"']+)["']/i,
    url: /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i,
  };

  const twitterPatterns: Record<Exclude<keyof OGMetadata, 'url'>, RegExp> = {
    title: /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i,
    description: /<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i,
    image: /<meta\s+name=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i,
  };

  // Extraer Open Graph
  for (const [key, pattern] of Object.entries(ogPatterns) as [keyof OGMetadata, RegExp][]) {
    const match = html.match(pattern);
    if (match && match[1]) {
      result[key] = decodeHtmlEntities(match[1]);
    }
  }

  // Fallback a Twitter Cards
  if (!result.title) {
    const match = html.match(twitterPatterns.title);
    if (match && match[1]) result.title = decodeHtmlEntities(match[1]);
  }
  if (!result.description) {
    const match = html.match(twitterPatterns.description);
    if (match && match[1]) result.description = decodeHtmlEntities(match[1]);
  }
  if (!result.image) {
    const match = html.match(twitterPatterns.image);
    if (match && match[1]) result.image = decodeHtmlEntities(match[1]);
  }

  return result;
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&iexcl;': '¡',
    '&iquest;': '¿',
  };
  return text.replace(/&[a-z]+;|&#\d+;/gi, (match) => entities[match] ?? match);
}

/**
 * Valida URL contra allowlist estricta.
 * Protección SSRF: sin redirecciones, solo HTTPS, hosts permitidos.
 */
function validateFacebookUrl(url: string): { valid: boolean; hostname?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return { valid: false };
    const hostname = parsed.hostname.toLowerCase();
    const allowed = ALLOWED_HOSTS.some(
      (h) => hostname === h || hostname.endsWith('.' + h)
    );
    if (!allowed) return { valid: false };
    return { valid: true, hostname };
  } catch {
    return { valid: false };
  }
}

/**
 * Fetch con protección SSRF: timeout, límite de tamaño, sin redirecciones.
 */
async function safeFetch(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'manual', // No seguir redirecciones (anti-SSRF)
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[FacebookPublicAdapter] HTTP ${response.status} for ${url}`);
      return null;
    }

    // Leer con límite de tamaño
    const reader = response.body?.getReader();
    if (!reader) return null;

    let totalSize = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > MAX_RESPONSE_SIZE) {
        console.warn(`[FacebookPublicAdapter] Response too large: ${totalSize} bytes`);
        return null;
      }
      chunks.push(value);
    }

    // Concatenar chunks
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return new TextDecoder('utf-8', { fatal: false }).decode(result);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`[FacebookPublicAdapter] Timeout fetching ${url}`);
    } else {
      console.warn(`[FacebookPublicAdapter] Fetch error for ${url}:`, error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Adaptador Facebook Público - Best effort, degradación grácil.
 * Si Facebook bloquea o cambia HTML, retorna [] y el flujo cae a "sube captura".
 */
export class FacebookPublicAdapter implements SourceAdapter {
  readonly name = 'FacebookPublicAdapter';
  readonly platform: ExternalPlatform = 'FACEBOOK_PUBLIC';
  readonly enabled = FACEBOOK_ADAPTER_ENABLED;

  async fetchPublic(source: SourceConfig, lastCursor: string | null): Promise<FetchResult> {
    if (!this.enabled) {
      return { posts: [], new_cursor: lastCursor, error: 'Adapter disabled by feature flag' };
    }

    if (!source.is_active) {
      return { posts: [], new_cursor: lastCursor, error: 'Source not active' };
    }

    // Facebook Público: el handle_or_url es la URL de la página
    // Ej: https://facebook.com/mascotasperdidas
    // Para lectura incremental, usaríamos Graph API (requiere token) o scraping de feed
    // Aquí implementamos best-effort: fetch de la página principal y extraer posts recientes
    // NOTA: Esto es frágil y Facebook puede bloquear. Por eso feature flag OFF por defecto.

    try {
      const html = await safeFetch(source.handle_or_url);
      if (!html) {
        return { posts: [], new_cursor: lastCursor, error: 'Failed to fetch page' };
      }

      // Extraer posts del feed público (simplificado)
      // En producción, se usaría Graph API con token de página
      // Aquí solo demostramos la estructura
      const posts: RawPost[] = [];
      
      // TODO: Implementar parsing real del feed de Facebook
      // Por ahora retornamos array vacío para degradación grácil
      
      return { posts, new_cursor: lastCursor };
    } catch (error) {
      console.error('[FacebookPublicAdapter] Unexpected error:', error);
      return { posts: [], new_cursor: lastCursor, error: String(error) };
    }
  }

  async checkHealth(source: SourceConfig): Promise<boolean> {
    if (!this.enabled) return false;
    const html = await safeFetch(source.handle_or_url);
    return html !== null && html.length > 0;
  }
}

// Exportar instancia singleton
export const facebookPublicAdapter = new FacebookPublicAdapter();

// Función helper para usar en admin panel
export async function fetchFacebookPublicPosts(
  sourceUrl: string,
  lastCursor: string | null
): Promise<FetchResult> {
  if (!FACEBOOK_ADAPTER_ENABLED) {
    return { posts: [], new_cursor: lastCursor, error: 'Feature flag disabled' };
  }

  const validation = validateFacebookUrl(sourceUrl);
  if (!validation.valid) {
    return { posts: [], new_cursor: lastCursor, error: 'Invalid Facebook URL' };
  }

  const source: SourceConfig = {
    id: 'temp',
    platform: 'FACEBOOK_PUBLIC',
    handle_or_url: sourceUrl,
    name: null,
    province: null,
    is_active: true,
    is_trusted: false,
    last_cursor: lastCursor,
  };

  return facebookPublicAdapter.fetchPublic(source, lastCursor);
}