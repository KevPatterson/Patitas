import { describe, expect, it } from 'vitest';
import { getResolvedCelebrationCopy } from '../resolved-message';

describe('getResolvedCelebrationCopy', () => {
  it('usa el nombre cuando el título lo permite', () => {
    expect(
      getResolvedCelebrationCopy({ title: 'Toby perdido en Playa', type: 'LOST' }).title
    ).toBe('¡Toby volvió a casa!');
    expect(
      getResolvedCelebrationCopy({ title: 'Luna: gata en adopción', type: 'ADOPTION' }).title
    ).toBe('¡Luna encontró una casa!');
  });

  it('usa la especie cuando el título no trae nombre', () => {
    expect(
      getResolvedCelebrationCopy({
        title: 'Perra encontrada en Centro Habana',
        type: 'LOST',
        species: 'dog',
        sex: 'female',
      }).title
    ).toBe('¡Tu perra volvió a casa!');

    expect(
      getResolvedCelebrationCopy({ title: 'Perro perdido', type: 'LOST', species: 'dog' }).title
    ).toBe('¡Tu perro volvió a casa!');
  });

  it('concuerda el sustantivo con el sexo del aviso', () => {
    expect(
      getResolvedCelebrationCopy({ type: 'FOUND', species: 'cat', sex: 'female' }).title
    ).toBe('¡Tu gata encontró a su familia!');
    expect(
      getResolvedCelebrationCopy({ type: 'FOUND', species: 'rabbit', sex: 'female' }).title
    ).toBe('¡Tu coneja encontró a su familia!');
  });

  it('adapta el mensaje a cada tipo de caso', () => {
    const base = { species: 'dog', sex: 'male' } as const;

    expect(getResolvedCelebrationCopy({ ...base, type: 'LOST' }).title).toBe(
      '¡Tu perro volvió a casa!'
    );
    expect(getResolvedCelebrationCopy({ ...base, type: 'FOUND' }).title).toBe(
      '¡Tu perro encontró a su familia!'
    );
    expect(getResolvedCelebrationCopy({ ...base, type: 'ADOPTION' }).title).toBe(
      '¡Tu perro encontró una casa!'
    );
    expect(getResolvedCelebrationCopy({ ...base, type: 'ABANDONED' }).title).toBe(
      '¡Tu perro encontró un hogar!'
    );
    expect(getResolvedCelebrationCopy({ ...base, type: 'SIGHTING' }).title).toBe(
      '¡Tu perro está a salvo!'
    );
  });

  it('cambia también el texto de apoyo según el tipo', () => {
    const lost = getResolvedCelebrationCopy({ type: 'LOST' }).subtitle;
    const adoption = getResolvedCelebrationCopy({ type: 'ADOPTION' }).subtitle;

    expect(lost).not.toBe(adoption);
    expect(adoption).toContain('hogar');
    expect(adoption).not.toContain('regresen');
  });

  it('cae en un mensaje genérico si falta el tipo o la especie', () => {
    expect(getResolvedCelebrationCopy({}).title).toBe('¡Tu mascota volvió a casa!');
    expect(getResolvedCelebrationCopy({ type: 'OTRO', species: 'desconocida' }).title).toBe(
      '¡Tu mascota volvió a casa!'
    );
  });

  it('acepta tipos en minúscula y especies con mayúscula', () => {
    expect(
      getResolvedCelebrationCopy({ type: 'adoption', species: 'CAT', sex: 'female' }).title
    ).toBe('¡Tu gata encontró una casa!');
  });

  it('usa el demostrativo cuando quien lee no es el dueño', () => {
    expect(
      getResolvedCelebrationCopy({ type: 'ABANDONED', species: 'dog', isOwner: false }).title
    ).toBe('¡Este perro encontró un hogar!');
    expect(
      getResolvedCelebrationCopy({
        type: 'LOST',
        species: 'dog',
        sex: 'female',
        isOwner: false,
      }).title
    ).toBe('¡Esta perra volvió a casa!');
    // «ave» es femenino aunque el aviso sea de un macho.
    expect(
      getResolvedCelebrationCopy({
        type: 'SIGHTING',
        species: 'bird',
        sex: 'male',
        isOwner: false,
      }).title
    ).toBe('¡Esta ave está a salvo!');
  });

  it('mantiene el mismo nombre para el dueño y para los visitantes', () => {
    const base = { title: 'Toby perdido en Playa', type: 'LOST' } as const;

    expect(getResolvedCelebrationCopy({ ...base, isOwner: true }).title).toBe(
      '¡Toby volvió a casa!'
    );
    expect(getResolvedCelebrationCopy({ ...base, isOwner: false }).title).toBe(
      '¡Toby volvió a casa!'
    );
  });
});
