import { describe, expect, it } from 'vitest';
import { ChatError, chatErrorMessage } from '../chat-error';

describe('chatErrorMessage', () => {
  it('prefiere el mensaje en español del detail JSON', () => {
    const error = {
      message: 'chat blocked',
      details: JSON.stringify({
        code: 'CHAT_BLOCKED',
        message: 'No puedes enviar mensajes a este usuario.',
      }),
      hint: 'No puedes enviar mensajes a este usuario.',
    };

    expect(chatErrorMessage(error, 'Error')).toBe('No puedes enviar mensajes a este usuario.');
  });

  it('usa el hint cuando el detail no es JSON', () => {
    const error = {
      message: 'conversation archived',
      details: 'texto plano',
      hint: 'Esta conversación está cerrada.',
    };

    expect(chatErrorMessage(error, 'Error')).toBe('Esta conversación está cerrada.');
  });

  it('conserva los mensajes propios ya redactados', () => {
    expect(chatErrorMessage(new ChatError('La conversación no existe.'), 'Error')).toBe(
      'La conversación no existe.'
    );
  });

  it('nunca muestra el texto técnico de PostgREST o de red', () => {
    expect(chatErrorMessage({ message: 'boom' }, 'No pudimos enviar el mensaje.')).toBe(
      'No pudimos enviar el mensaje.'
    );
    expect(chatErrorMessage(new TypeError('Failed to fetch'), 'Sin conexión')).toBe('Sin conexión');
    expect(chatErrorMessage({}, 'No pudimos enviar el mensaje.')).toBe(
      'No pudimos enviar el mensaje.'
    );
    expect(chatErrorMessage(null, 'Respaldo')).toBe('Respaldo');
  });

  it('ignora detalles vacíos o mal formados', () => {
    const error = {
      details: JSON.stringify({ message: '   ' }),
      message: 'mensaje técnico',
    };

    expect(chatErrorMessage(error, 'Error')).toBe('Error');
  });
});
