import { describe, expect, it } from 'vitest';
import {
  getChatButtonLabel,
  getChatTypeHint,
  getSuggestedMessage,
} from '../chat-copy';

describe('copy del chat', () => {
  it('adapta el botón al tipo de publicación', () => {
    expect(getChatButtonLabel('ADOPTION')).toBe('Escribir al dueño');
    expect(getChatButtonLabel('LOST')).toBe('Tengo información');
    expect(getChatButtonLabel('FOUND')).toBe('Creo que es mi mascota');
    expect(getChatButtonLabel('SIGHTING')).toBe('Tengo información');
    expect(getChatButtonLabel('ABANDONED')).toBe('Quiero ayudar');
  });

  it('usa un texto genérico cuando falta el tipo', () => {
    expect(getChatButtonLabel(null)).toBe('Escribir al dueño');
    expect(getChatButtonLabel('DESCONOCIDO')).toBe('Escribir un mensaje');
    expect(getChatTypeHint(null)).toBe('');
  });

  it('sugiere un primer mensaje con el nombre de la publicación', () => {
    const adoption = getSuggestedMessage('ADOPTION', 'Michi en adopción');
    const lost = getSuggestedMessage('LOST', 'Firulais');

    expect(adoption).toContain('Michi en adopción');
    expect(lost).toContain('Firulais');
    expect(adoption).not.toBe(lost);
  });

  it('no deja el mensaje sugerido a medias si el título está vacío', () => {
    expect(getSuggestedMessage('LOST', '   ')).toContain('tu publicación');
    expect(getSuggestedMessage('LOST', null)).toContain('tu publicación');
  });
});
