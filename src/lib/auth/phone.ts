/**
 * Utilidades de teléfono para el acceso por OTP (SMS o WhatsApp).
 *
 * Supabase exige el número en formato E.164 (`+5351234567`). La mayoría de los
 * usuarios escribe el número local cubano, así que se normaliza antes de enviarlo.
 */

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const CUBA_COUNTRY_CODE = '53';

/**
 * Normaliza un teléfono escrito por el usuario.
 *
 * - Quita espacios, puntos, guiones y paréntesis.
 * - Convierte el prefijo internacional `00` en `+`.
 * - Si no trae prefijo, asume Cuba (`+53`), salvo que ya incluya el `53`.
 */
export function normalizePhone(input: string): string {
  let value = input.trim().replace(/[\s().-]/g, '');

  if (value.startsWith('00')) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith('+')) {
    return value;
  }

  if (!/^\d+$/.test(value)) {
    return value;
  }

  if (value.startsWith(CUBA_COUNTRY_CODE) && value.length >= 10) {
    return `+${value}`;
  }

  return `+${CUBA_COUNTRY_CODE}${value}`;
}

/** Valida un teléfono ya normalizado en formato E.164. */
export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}
