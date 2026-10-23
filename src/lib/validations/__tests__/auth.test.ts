import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  registerSchema,
  newPasswordSchema,
  resetPasswordSchema,
} from '../auth';

/**
 * Tarea 7.1 · Validaciones Zod de autenticación.
 *
 * Se prueban las reglas de la tarea 4.8, que son las que más fácil se rompen al
 * tocar el formulario:
 *   - entrar NO exige complejidad (quien tiene una contraseña antigua debe poder
 *     acceder),
 *   - registrarse y cambiarla SÍ (8-72, letra y número),
 *   - el máximo de 72 viene del límite de bcrypt.
 */

describe('loginSchema', () => {
  const valid = { email: 'persona@ejemplo.com', password: 'x' };

  it('acepta una contraseña débil al iniciar sesión', () => {
    // Un usuario con una contraseña antigua de 1 carácter no debe quedar fuera.
    expect(loginSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza una contraseña vacía', () => {
    const result = loginSchema.safeParse({ ...valid, password: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/contraseña/i);
    }
  });

  it('rechaza más de 72 caracteres', () => {
    expect(loginSchema.safeParse({ ...valid, password: 'a'.repeat(73) }).success).toBe(false);
    expect(loginSchema.safeParse({ ...valid, password: 'a'.repeat(72) }).success).toBe(true);
  });

  it('rechaza un email inválido', () => {
    for (const email of ['sin-arroba', 'a@b', '@ejemplo.com', '', ' dos@espacios.com']) {
      expect(loginSchema.safeParse({ ...valid, email }).success, email).toBe(false);
    }
  });
});

describe('registerSchema · política de contraseña', () => {
  const base = {
    fullName: 'Kevin Patterson',
    username: 'kevin',
    email: 'persona@ejemplo.com',
    password: 'patitas2026',
  };

  it('acepta una contraseña que cumple la política', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('exige al menos 8 caracteres', () => {
    expect(registerSchema.safeParse({ ...base, password: 'a1b2c3d' }).success).toBe(false);
  });

  it('exige al menos una letra', () => {
    const result = registerSchema.safeParse({ ...base, password: '12345678' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /letra/i.test(i.message))).toBe(true);
    }
  });

  it('exige al menos un número', () => {
    const result = registerSchema.safeParse({ ...base, password: 'sololetras' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /número/i.test(i.message))).toBe(true);
    }
  });

  it('rechaza más de 72 caracteres (límite de bcrypt)', () => {
    expect(registerSchema.safeParse({ ...base, password: `${'a1'.repeat(37)}` }).success).toBe(
      false
    );
  });

  it('valida el username: mínimo 3 y solo caracteres permitidos', () => {
    for (const username of ['ab', 'con espacio', 'con@arroba', 'ñandú']) {
      expect(registerSchema.safeParse({ ...base, username }).success, username).toBe(false);
    }

    for (const username of ['abc', 'kevin.p', 'kevin_p', 'kevin-p', 'Kevin123']) {
      expect(registerSchema.safeParse({ ...base, username }).success, username).toBe(true);
    }
  });

  it('exige un nombre de al menos 2 caracteres', () => {
    expect(registerSchema.safeParse({ ...base, fullName: 'K' }).success).toBe(false);
  });
});

describe('newPasswordSchema · confirmación', () => {
  const base = { password: 'patitas2026', confirmPassword: 'patitas2026' };

  it('acepta cuando coinciden', () => {
    expect(newPasswordSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza cuando no coinciden y señala el campo', () => {
    const result = newPasswordSchema.safeParse({ ...base, confirmPassword: 'otracosa2026' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });

  it('aplica la misma política de complejidad', () => {
    expect(newPasswordSchema.safeParse({ password: 'corta1', confirmPassword: 'corta1' }).success).toBe(
      false
    );
  });
});

describe('resetPasswordSchema', () => {
  it('solo necesita un email válido', () => {
    expect(resetPasswordSchema.safeParse({ email: 'persona@ejemplo.com' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ email: 'no-es-email' }).success).toBe(false);
  });
});
