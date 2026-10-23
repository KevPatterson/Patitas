import { describe, expect, it } from 'vitest';
import { formatChatTime, formatRelativeChatTime } from '../chat-format';

describe('formato de fechas del chat', () => {
  it('devuelve cadena vacía para fechas inválidas', () => {
    expect(formatChatTime('no-es-fecha')).toBe('');
    expect(formatRelativeChatTime('no-es-fecha')).toBe('');
  });

  it('muestra la hora de los mensajes del mismo día', () => {
    const morning = new Date();
    morning.setHours(9, 5, 0, 0);

    expect(formatChatTime(morning.toISOString())).toMatch(/\d{1,2}:\d{2}/);
  });

  it('añade la fecha cuando el mensaje es de otro día', () => {
    const formatted = formatChatTime('2020-01-02T10:30:00.000Z');

    expect(formatted).toContain('2020');
  });

  it('usa tiempos relativos para la bandeja', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();

    expect(formatRelativeChatTime(fiveMinutesAgo)).toContain('5');
  });
});
