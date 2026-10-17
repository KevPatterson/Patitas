/**
 * Traducción de errores de autenticación a mensajes seguros.
 *
 * Tarea 4.8: evitar **enumeración de cuentas**. Si el login devuelve
 * "Email not confirmed" o el reset distingue entre "usuario no existe" y
 * "enviado", cualquiera puede averiguar qué correos están registrados probando
 * uno a uno. Supabase ya es bastante opaco, pero el mensaje llegaba tal cual a la
 * UI (en inglés y a veces revelador).
 *
 * Reglas:
 *   - Todo fallo de credenciales (incluido email sin confirmar) → el MISMO
 *     mensaje genérico.
 *   - Los errores de red o de rate limit sí se distinguen: no revelan nada sobre
 *     la cuenta y ayudan al usuario.
 */

export type AuthErrorLike = {
  message?: string;
  status?: number;
  code?: string;
} | null;

export const GENERIC_LOGIN_ERROR =
  'Email o contraseña incorrectos. Si aún no confirmaste tu correo, revisa tu bandeja de entrada.';

export const GENERIC_RESET_SENT =
  'Si esa dirección tiene una cuenta, te enviamos un enlace para restablecer la contraseña. Revisa tu correo (y la carpeta de spam).';

export const RATE_LIMIT_ERROR =
  'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';

export const NETWORK_ERROR =
  'No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.';

/** Normaliza el error que devuelve Supabase (o un Error cualquiera). */
function normalize(error: unknown): AuthErrorLike {
  if (!error) return null;

  if (typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    return {
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
    };
  }

  return { message: String(error) };
}

function looksLikeNetworkError(error: AuthErrorLike): boolean {
  const message = (error?.message ?? '').toLowerCase();

  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('load failed')
  );
}

function looksLikeRateLimit(error: AuthErrorLike): boolean {
  const message = (error?.message ?? '').toLowerCase();

  return (
    error?.status === 429 ||
    error?.code === 'over_email_send_rate_limit' ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('for security purposes')
  );
}

/**
 * Mensaje para un intento de inicio de sesión fallido.
 * Nunca distingue "no existe" de "contraseña incorrecta" ni de "sin confirmar".
 */
export function loginErrorMessage(error: unknown): string {
  const normalized = normalize(error);

  if (looksLikeNetworkError(normalized)) return NETWORK_ERROR;
  if (looksLikeRateLimit(normalized)) return RATE_LIMIT_ERROR;

  return GENERIC_LOGIN_ERROR;
}

/**
 * Mensaje para una solicitud de recuperación de contraseña.
 *
 * Devuelve `null` cuando la operación se considera correcta: la UI debe mostrar
 * siempre `GENERIC_RESET_SENT`, exista o no la cuenta.
 */
export function resetPasswordErrorMessage(error: unknown): string | null {
  const normalized = normalize(error);

  if (looksLikeNetworkError(normalized)) return NETWORK_ERROR;
  if (looksLikeRateLimit(normalized)) return RATE_LIMIT_ERROR;

  // Cualquier otro error (incluido "user not found") se trata como enviado.
  return null;
}

/**
 * Mensaje para el registro.
 *
 * Aquí sí conviene ser algo más concreto (contraseña débil, email inválido),
 * pero **no** se confirma si el email ya está en uso: se responde igual y se
 * sugiere iniciar sesión.
 */
export function registerErrorMessage(error: unknown): string {
  const normalized = normalize(error);
  const message = (normalized?.message ?? '').toLowerCase();

  if (looksLikeNetworkError(normalized)) return NETWORK_ERROR;
  if (looksLikeRateLimit(normalized)) return RATE_LIMIT_ERROR;

  if (message.includes('password') && (message.includes('weak') || message.includes('short'))) {
    return 'La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.';
  }

  // "already registered" / "already exists" → mismo mensaje que el éxito.
  return 'Revisa tu correo para confirmar la cuenta. Si ya tenías una, inicia sesión.';
}
