import { describe, expect, it } from 'vitest';
import { getPetNameFromTitle } from '../pet-name';

describe('getPetNameFromTitle', () => {
  it('devuelve el nombre cuando el título empieza por él', () => {
    expect(getPetNameFromTitle('Toby perdido en Playa')).toBe('Toby');
    expect(getPetNameFromTitle('Luna, la gata perdida')).toBe('Luna');
    expect(getPetNameFromTitle('Rocky: perro encontrado en Vedado')).toBe('Rocky');
  });

  it('no confunde la especie con el nombre', () => {
    expect(getPetNameFromTitle('Perra encontrada en Centro Habana')).toBeUndefined();
    expect(getPetNameFromTitle('Gata rescatada en Vedado')).toBeUndefined();
    expect(getPetNameFromTitle('Perro perdido en Playa')).toBeUndefined();
  });

  it('no confunde el estado ni las palabras de inicio con el nombre', () => {
    expect(getPetNameFromTitle('Se perdió un perro en Playa')).toBeUndefined();
    expect(getPetNameFromTitle('Encontrado en Centro Habana')).toBeUndefined();
    expect(getPetNameFromTitle('Urgente: gato perdido')).toBeUndefined();
  });

  it('no devuelve nada con títulos vacíos o sin letras', () => {
    expect(getPetNameFromTitle('')).toBeUndefined();
    expect(getPetNameFromTitle(null)).toBeUndefined();
    expect(getPetNameFromTitle('🐶 🐾')).toBeUndefined();
  });
});
