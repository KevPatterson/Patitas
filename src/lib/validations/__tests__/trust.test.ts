import { describe, expect, it } from 'vitest';
import {
  alertSubscriptionSchema,
  verificationRequestSchema,
} from '../trust';

/**
 * Validaciones de confianza y alertas.
 *
 * Lo que se protege aquí:
 *   - una alerta sin tipos o con tipos repetidos no debe guardarse;
 *   - la evidencia de verificación solo acepta enlaces https;
 *   - las notas no superan el límite de la base de datos.
 */

describe('alertSubscriptionSchema', () => {
  const valid = {
    province: 'La Habana',
    municipality: 'Marianao',
    types: ['LOST', 'FOUND'] as const,
    isActive: true,
  };

  it('acepta una suscripción válida', () => {
    expect(alertSubscriptionSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza una suscripción sin tipos', () => {
    expect(alertSubscriptionSchema.safeParse({ ...valid, types: [] }).success).toBe(false);
  });

  it('rechaza tipos repetidos', () => {
    expect(
      alertSubscriptionSchema.safeParse({ ...valid, types: ['LOST', 'LOST'] }).success
    ).toBe(false);
  });

  it('rechaza un municipio vacío', () => {
    expect(alertSubscriptionSchema.safeParse({ ...valid, municipality: '  ' }).success).toBe(false);
  });

  it('rechaza tipos que no son de alerta', () => {
    expect(alertSubscriptionSchema.safeParse({ ...valid, types: ['ADOPTION'] }).success).toBe(false);
  });
});

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
