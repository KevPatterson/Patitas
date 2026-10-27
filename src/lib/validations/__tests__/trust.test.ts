import { describe, expect, it } from 'vitest';
import { verificationRequestSchema } from '../trust';

/**
 * Validaciones de la solicitud de verificación.
 *
 * Lo que se protege aquí:
 *   - la evidencia solo acepta enlaces https;
 *   - las notas no superan el límite de la base de datos;
 *   - el tipo de verificación pertenece al catálogo.
 */

describe('verificationRequestSchema', () => {
  const valid = {
    kind: 'RESCUER' as const,
    evidenceUrl: 'https://ejemplo.com/mi-trabajo',
    note: 'Rescatista en Marianao desde 2021.',
  };

  it('acepta una solicitud válida', () => {
    expect(verificationRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('permite no adjuntar evidencia', () => {
    expect(verificationRequestSchema.safeParse({ ...valid, evidenceUrl: '' }).success).toBe(true);
  });

  it('rechaza enlaces que no sean https', () => {
    expect(
      verificationRequestSchema.safeParse({ ...valid, evidenceUrl: 'http://ejemplo.com' }).success
    ).toBe(false);
  });

  it('rechaza una nota de más de 500 caracteres', () => {
    expect(
      verificationRequestSchema.safeParse({ ...valid, note: 'a'.repeat(501) }).success
    ).toBe(false);
  });

  it('rechaza un tipo de verificación desconocido', () => {
    expect(
      verificationRequestSchema.safeParse({ ...valid, kind: 'CELEBRITY' }).success
    ).toBe(false);
  });
});
