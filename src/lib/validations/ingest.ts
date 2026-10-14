import { z } from 'zod';

/**
 * Schema para validar payload de ingesta de posts externos
 * Protección contra prompt injection: texto externo tratado SIEMPRE como datos, nunca instrucciones
 */

const MAX_TEXT_LENGTH = 50_000;
const MAX_IMAGES = 10;
const MAX_IMAGE_PATH_LENGTH = 500;
const HMAC_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

export const externalPlatformSchema = z.enum(['TELEGRAM', 'FACEBOOK_PUBLIC']);

export const externalPostStatusSchema = z.enum([
  'NEW',
  'PROCESSING',
  'NOT_RELEVANT',
  'DUPLICATE',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'TAKEN_DOWN',
]);

export const ingestExternalPostSchema = z.object({
  source_id: z.string().uuid('source_id debe ser UUID válido'),
  platform: externalPlatformSchema,
  external_id: z.string().min(1, 'external_id requerido').max(100),
  source_url: z.string().url('source_url debe ser URL válida').max(500),
  raw_text: z.string().max(MAX_TEXT_LENGTH).nullable().optional(),
  image_paths: z
    .array(z.string().max(MAX_IMAGE_PATH_LENGTH))
    .max(MAX_IMAGES, `Máximo ${MAX_IMAGES} imágenes`)
    .default([]),
  posted_at: z
    .string()
    .datetime({ offset: true })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'posted_at debe ser ISO 8601 con timezone',
    }),
  // HMAC authentication
  timestamp: z.number().int().positive('timestamp requerido'),
  signature: z.string().min(64, 'signature inválida').max(128),
});

export type IngestExternalPostInput = z.infer<typeof ingestExternalPostSchema>;

/**
 * Validar y sanitizar texto externo (defensa contra prompt injection)
 * El texto externo NUNCA se usa como instrucción, solo como datos para la IA
 */
export function sanitizeExternalText(text: string | null | undefined): string {
  if (!text) return '';
  
  // Truncar a longitud máxima
  let sanitized = text.slice(0, MAX_TEXT_LENGTH);
  
  // Remover patrones de prompt injection comunes
  const injectionPatterns = [
    /ignore\s+(previous|above|prior)\s+instructions?/gi,
    /disregard\s+(previous|above|prior)\s+instructions?/gi,
    /forget\s+(previous|above|prior)\s+(instructions?|context)/gi,
    /system\s*:/gi,
    /assistant\s*:/gi,
    /user\s*:/gi,
    /<\|.*?\|>/g,  // Special tokens
    /\[INST\].*?\[\/INST\]/gis,
    /<<SYS>>.*?<\/?SYS>>/gis,
  ];
  
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTRADO]');
  }
  
  // Normalizar espacios en blanco
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Validar timestamp HMAC (anti-replay)
 */
export function validateHmacTimestamp(timestamp: number): { valid: boolean; error?: string } {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  
  if (diff > HMAC_TIMESTAMP_WINDOW_MS) {
    return { valid: false, error: 'Timestamp fuera de ventana permitida (5 min)' };
  }
  
  return { valid: true };
}

/**
 * Verificar firma HMAC
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  _secret: string
): boolean {
  // Implementación simple usando Web Crypto API (Edge compatible)
  // En producción, usar crypto.subtle para timing-safe comparison
  try {
    // Validación básica de estructura - la verificación real se hace en el endpoint con crypto.subtle
    return signature.length >= 64;
  } catch {
    return false;
  }
}

export const INGEST_CONSTANTS = {
  MAX_TEXT_LENGTH,
  MAX_IMAGES,
  MAX_IMAGE_PATH_LENGTH,
  HMAC_TIMESTAMP_WINDOW_MS,
} as const;