import { describe, expect, it } from 'vitest';
import {
  GENERIC_LOGIN_ERROR,
  GENERIC_RESET_SENT,
  NETWORK_ERROR,
  RATE_LIMIT_ERROR,
  loginErrorMessage,
  registerErrorMessage,
  resetPasswordErrorMessage,
} from '../error-messages';

/**
 * Tarea 7.1 · Prevención de enumeración de cuentas (4.8).
 *
 * La propiedad que hay que blindar es una sola: **el mensaje no debe permitir
 * deducir si un correo está registrado**. Estos tests fijan esa propiedad para
 * que un cambio futuro en el manejo de errores no la rompa en silencio.
 */

describe('loginErrorMessage · no filtra si la cuenta existe', () => {
  it('devuelve el MISMO mensaje para credenciales incorrectas y para email sin confirmar', () => {
    const wrongPassword = loginErrorMessage({ message: 'Invalid login credentials', status: 400 });
    const notConfirmed = loginErrorMessage({ message: 'Email not confirmed', status: 400 });
    const userNotFound = loginErrorMessage({ message: 'User not found', status: 400 });

    expect(wrongPassword).toBe(GENERIC_LOGIN_ERROR);
    expect(notConfirmed).toBe(GENERIC_LOGIN_ERROR);
    expect(userNotFound).toBe(GENERIC_LOGIN_ERROR);
  });

  it('no incluye el texto original de Supabase', () => {
    const message = loginErrorMessage({ message: 'Email not confirmed' });

    expect(message).not.toMatch(/email not confirmed/i);
    expect(message).not.toMatch(/invalid login/i);
  });

  it('distingue un fallo de red (no revela nada de la cuenta)', () => {
    expect(loginErrorMessage({ message: 'Failed to fetch' })).toBe(NETWORK_ERROR);
    expect(loginErrorMessage({ message: 'Load failed' })).toBe(NETWORK_ERROR);
  });

  it('distingue el rate limit (tampoco revela nada)', () => {
    expect(loginErrorMessage({ status: 429 })).toBe(RATE_LIMIT_ERROR);
    expect(
      loginErrorMessage({ message: 'For security purposes, you can only request this after 60s' })
    ).toBe(RATE_LIMIT_ERROR);
  });

  it('tolera errores raros sin romperse', () => {
    expect(loginErrorMessage(null)).toBe(GENERIC_LOGIN_ERROR);
    expect(loginErrorMessage(undefined)).toBe(GENERIC_LOGIN_ERROR);
    expect(loginErrorMessage('texto suelto')).toBe(GENERIC_LOGIN_ERROR);
    expect(loginErrorMessage({})).toBe(GENERIC_LOGIN_ERROR);
  });
});

describe('resetPasswordErrorMessage · la recuperación siempre "envía"', () => {
  it('no bloquea cuando el usuario no existe', () => {
    // La UI muestra el mensaje de "si esa dirección tiene cuenta…", así que aquí
    // no debe haber error que delate la inexistencia.
    expect(resetPasswordErrorMessage({ message: 'User not found' })).toBeNull();
    expect(resetPasswordErrorMessage({ message: 'Unable to find user' })).toBeNull();
  });

  it('sí informa de un problema de red o de rate limit', () => {
    expect(resetPasswordErrorMessage({ message: 'Failed to fetch' })).toBe(NETWORK_ERROR);
    expect(resetPasswordErrorMessage({ status: 429 })).toBe(RATE_LIMIT_ERROR);
  });

  it('el mensaje de éxito no confirma que la cuenta exista', () => {
    // "Si esa dirección tiene una cuenta…" es condicional a propósito.
    expect(GENERIC_RESET_SENT).toMatch(/^si esa dirección/i);
  });
});

describe('registerErrorMessage', () => {
  it('no confirma si el email ya estaba registrado', () => {
    const alreadyRegistered = registerErrorMessage({
      message: 'User already registered',
      status: 422,
    });

    // Mismo mensaje que un registro correcto: no se puede enumerar por ahí.
    expect(alreadyRegistered).not.toMatch(/ya (está|esta) registrad/i);
    expect(alreadyRegistered).toMatch(/revisa tu correo/i);
  });

  it('explica una contraseña débil, que sí es información del propio usuario', () => {
    expect(registerErrorMessage({ message: 'Password is too weak' })).toMatch(/contraseña/i);
  });

  it('distingue red y rate limit', () => {
    expect(registerErrorMessage({ message: 'Failed to fetch' })).toBe(NETWORK_ERROR);
    expect(registerErrorMessage({ status: 429 })).toBe(RATE_LIMIT_ERROR);
  });
});
