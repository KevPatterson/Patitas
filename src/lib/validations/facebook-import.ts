import { z } from 'zod';

/**
 * Validación para importación desde enlace de Facebook
 * Protección SSRF: allowlist estricta de dominios, sin redirecciones, timeout corto
 */

const FACEBOOK_ALLOWED_HOSTS = [
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'mbasic.facebook.com',
  'fb.com',
  'fb.watch',
  'www.fb.com',
  'l.facebook.com',  // Link shim
  'lm.facebook.com',
] as const;

const FACEBOOK_ALLOWED_SCHEMES = ['https:'] as const;

export const facebookLinkImportSchema = z.object({
  url: z.string()
    .url('URL inválida')
    .refine((url) => {
      try {
        const parsed = new URL(url);
        // Solo HTTPS
        if (parsed.protocol !== 'https:') {
          return false;
        }
        // Host en allowlist
        const hostname = parsed.hostname.toLowerCase();
        return FACEBOOK_ALLOWED_HOSTS.some((allowed) =>
          hostname === allowed || hostname.endsWith('.' + allowed)
        );
      } catch {
        return false;
      }
    }, 'Solo se permiten enlaces de facebook.com, fb.com, fb.watch'),
});

export type FacebookLinkImportInput = z.infer<typeof facebookLinkImportSchema>;

export const FACEBOOK_IMPORT_CONSTANTS = {
  ALLOWED_HOSTS: FACEBOOK_ALLOWED_HOSTS,
  ALLOWED_SCHEMES: FACEBOOK_ALLOWED_SCHEMES,
  REQUEST_TIMEOUT_MS: 8000,
  MAX_RESPONSE_SIZE: 2 * 1024 * 1024, // 2MB
  USER_AGENT: 'Mozilla/5.0 (compatible; PatitasBot/1.0; +https://patitas.app/bot)',
} as const;

interface OGMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
}

/**
 * Extraer metadatos Open Graph de HTML
 */
export function extractOpenGraphMetadata(html: string): OGMetadata {
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
  
  // Fallback a twitter cards si no hay OG
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
    if (match && match[1]) result.image = match[1];
  }
  
  // Fallback a <title> tag
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) result.title = decodeHtmlEntities(titleMatch[1]);
  }
  
  // Fallback a meta description
  if (!result.description) {
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (descMatch && descMatch[1]) result.description = decodeHtmlEntities(descMatch[1]);
  }
  
  return result;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}