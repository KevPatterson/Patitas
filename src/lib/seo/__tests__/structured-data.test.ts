import { describe, expect, it } from 'vitest';
import { generateFaqStructuredData, generateLostPetStructuredData } from '../structured-data';

/** Convierte el JSON-LD serializado para poder inspeccionarlo en los tests. */
function parse(json: string): Record<string, unknown> {
  return JSON.parse(json) as Record<string, unknown>;
}

describe('generateFaqStructuredData', () => {
  it('genera un FAQPage con una pregunta por cada elemento', () => {
    const items = [
      { question: '¿Qué es Patitas?', answer: 'Una plataforma comunitaria.' },
      { question: '¿Cuánto cuesta?', answer: 'Nada.' },
    ];

    const data = parse(generateFaqStructuredData(items, 'https://patitass.vercel.app/preguntas-frecuentes'));

    expect(data['@type']).toBe('FAQPage');
    expect(data.inLanguage).toBe('es-CU');
    expect(data.url).toBe('https://patitass.vercel.app/preguntas-frecuentes');

    const entities = data.mainEntity as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(2);
    expect(entities[0]?.['@type']).toBe('Question');
    expect(entities[0]?.name).toBe('¿Qué es Patitas?');
    expect((entities[0]?.acceptedAnswer as Record<string, unknown>).text).toBe(
      'Una plataforma comunitaria.'
    );
  });

  it('escapa etiquetas para que no puedan cerrar el script', () => {
    const json = generateFaqStructuredData(
      [{ question: 'Perro </script><script>alert(1)</script>', answer: 'a > b & c < d' }],
      'https://patitass.vercel.app/preguntas-frecuentes'
    );

    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c');
    expect(json).toContain('\\u0026');
  });
});

describe('generateLostPetStructuredData', () => {
  it('describe el caso como Article sobre una mascota', () => {
    const data = parse(
      generateLostPetStructuredData({
        name: 'Firulais perdido en Centro Habana',
        description: 'Perro mediano, color café, collar rojo.',
        image: 'https://patitass.vercel.app/firulais.jpg',
        species: 'Perro',
        location: { municipality: 'Centro Habana', province: 'La Habana' },
        datePosted: '2026-10-20T10:00:00.000Z',
        url: 'https://patitass.vercel.app/p/firulais-centro-habana',
      })
    );

    expect(data['@type']).toBe('Article');
    expect(data.headline).toBe('Firulais perdido en Centro Habana');
    expect(data.inLanguage).toBe('es-CU');
    expect(data.datePublished).toBe('2026-10-20T10:00:00.000Z');

    const about = data.about as Record<string, unknown>;
    expect(about['@type']).toBe('Thing');
    expect(about.additionalType).toBe('https://schema.org/Pet');
    expect(about.name).toBe('Perro');

    const location = data.contentLocation as Record<string, unknown>;
    const address = location.address as Record<string, unknown>;
    expect(address.addressLocality).toBe('Centro Habana');
    expect(address.addressRegion).toBe('La Habana');
    expect(address.addressCountry).toBe('CU');

    expect(data.publisher).toEqual({
      '@id': 'https://patitass.vercel.app/#organization',
    });
  });
});
