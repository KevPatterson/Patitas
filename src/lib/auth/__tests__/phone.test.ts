import { describe, expect, it } from 'vitest';
import { isValidPhone, normalizePhone } from '../phone';

describe('normalizePhone', () => {
  it('normaliza números locales cubanos a E.164', () => {
    expect(normalizePhone('5 123 4567')).toBe('+5351234567');
    expect(normalizePhone('5-123-4567')).toBe('+5351234567');
    expect(normalizePhone('(5) 123 4567')).toBe('+5351234567');
  });

  it('respeta el prefijo internacional y el 00', () => {
    expect(normalizePhone('+53 5 123 4567')).toBe('+5351234567');
    expect(normalizePhone('0053 5 123 4567')).toBe('+5351234567');
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('reconoce un número que ya incluye el código de Cuba', () => {
    expect(normalizePhone('5351234567')).toBe('+5351234567');
  });

  it('deja intactos los valores que no puede normalizar', () => {
    expect(normalizePhone('abc')).toBe('abc');
    expect(normalizePhone('++53')).toBe('++53');
  });
});

describe('isValidPhone', () => {
  it('acepta teléfonos E.164', () => {
    expect(isValidPhone('+5351234567')).toBe(true);
    expect(isValidPhone('+15551234567')).toBe(true);
  });

  it('rechaza formatos inválidos', () => {
    expect(isValidPhone('5351234567')).toBe(false);
    expect(isValidPhone('+0123456789')).toBe(false);
    expect(isValidPhone('+53 5 123 4567')).toBe(false);
    expect(isValidPhone('+123')).toBe(false);
  });
});
