/**
 * Errores del chat.
 *
 * Vive fuera de `supabase/chat.ts` a propósito: así se puede probar sin cargar
 * el cliente de Supabase, que exige variables de entorno al importarse.
 */

/** Error con un mensaje ya redactado para la persona que usa la app. */
export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatError';
  }
}

/**
 * Traduce un error de Supabase/PostgREST a un texto mostrable.
 *
 * Preferencia:
 *   1. Un `ChatError` nuestro, que ya viene en español.
 *   2. `details` en JSON con `{ code, message }` (las RPC del chat lo usan).
 *   3. `hint`, que también escribimos en español para la persona.
 *   4. El texto de respaldo de la pantalla.
 *
 * Los errores técnicos de PostgREST o de red nunca se muestran: al usuario no
 * le sirve "Could not find the table..." ni "Failed to fetch".
 */
export function chatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ChatError) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { details?: unknown; hint?: unknown };

    if (typeof candidate.details === 'string') {
      try {
        const detail = JSON.parse(candidate.details) as { message?: unknown };
        if (typeof detail.message === 'string' && detail.message.trim()) {
          return detail.message;
        }
      } catch {
        // El detalle no era JSON: se sigue con el hint o el respaldo.
      }
    }

    if (typeof candidate.hint === 'string' && candidate.hint.trim()) {
      return candidate.hint;
    }
  }

  return fallback;
}
