import { describe, expect, it } from 'vitest';
import {
  buildPosterFacts,
  buildPosterFilename,
  buildPosterLocation,
  buildPosterUrl,
  getPosterHeadline,
  getPosterTypeLabel,
} from '../publication-poster';

describe('cartel de publicación', () => {
  it('construye la URL canónica del caso', () => {
    expect(buildPosterUrl('toby-perdido', 'https://patitas.cu')).toBe(
      'https://patitas.cu/p/toby-perdido'
    );
    // No debe duplicar la barra final de la base.
    expect(buildPosterUrl('toby', 'https://patitas.cu/')).toBe('https://patitas.cu/p/toby');
  });

  it('codifica el slug para que la URL siga siendo válida', () => {
    expect(buildPosterUrl('toby con espacio', 'https://patitas.cu')).toBe(
      'https://patitas.cu/p/toby%20con%20espacio'
    );
  });

  it('genera un nombre de archivo seguro y sin acentos', () => {
    expect(buildPosterFilename('Perdido en La Habana')).toBe('patitas-Perdido-en-La-Habana.png');
    expect(buildPosterFilename('Añejo')).toBe('patitas-Anejo.png');
    expect(buildPosterFilename('  ')).toBe('patitas-caso.png');
  });

  it('compone la ubicación sin huecos ni comas sueltas', () => {
    expect(
      buildPosterLocation({ title: 'Toby', type: 'LOST', slug: 'toby', zone: 'Vedado', municipality: 'Plaza', province: 'La Habana' })
    ).toBe('Vedado, Plaza, La Habana');

    expect(
      buildPosterLocation({ title: 'Toby', type: 'LOST', slug: 'toby', zone: null, municipality: 'Plaza', province: 'La Habana' })
    ).toBe('Plaza, La Habana');

    expect(
      buildPosterLocation({ title: 'Toby', type: 'LOST', slug: 'toby', zone: '   ', municipality: null, province: null })
    ).toBe('');
  });

  it('resume los datos del animal y descarta los desconocidos', () => {
    expect(
      buildPosterFacts({
        title: 'Toby',
        type: 'LOST',
        slug: 'toby',
        species: 'dog',
        breed: 'Mestizo',
        sex: 'male',
        size: 'medium',
        ageApprox: 'adult',
      })
    ).toEqual(['Perro', 'Mestizo', 'Macho', 'Mediano']);

    expect(
      buildPosterFacts({
        title: 'Toby',
        type: 'LOST',
        slug: 'toby',
        species: 'dog',
        sex: 'unknown',
        size: null,
        ageApprox: null,
      })
    ).toEqual(['Perro']);
  });

  it('limita los datos a cuatro para que quepan en el cartel', () => {
    const facts = buildPosterFacts({
      title: 'Toby',
      type: 'LOST',
      slug: 'toby',
      species: 'dog',
      breed: 'Mestizo',
      sex: 'male',
      size: 'medium',
      ageApprox: 'adult',
    });

    expect(facts).toHaveLength(4);
  });

  it('usa etiquetas y titulares propios de cada tipo de caso', () => {
    expect(getPosterTypeLabel('LOST')).toBe('PERDIDO');
    expect(getPosterTypeLabel('ADOPTION')).toBe('EN ADOPCIÓN');
    expect(getPosterHeadline('FOUND')).toBe('Busca a su familia');
    // Cualquier tipo desconocido debe seguir teniendo un cartel presentable.
    expect(getPosterTypeLabel('OTRO')).toBe('CASO');
  });
});
