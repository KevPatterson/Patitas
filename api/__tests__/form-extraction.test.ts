import { describe, expect, it } from 'vitest';
import {
  buildFormExtraction,
  extractAttributesFromVision,
  extractStructuredDataFromText,
  findMunicipality,
  parseVisionJson,
  resolveCoordinates,
} from '../_lib/ai/form-extraction';
import {
  extractOpenGraphMetadata,
  extractPostText,
  isFacebookBoilerplate,
} from '../../src/lib/validations/facebook-import';

/**
 * Estos tests fijan el contrato del autocompletado del formulario.
 *
 * El desajuste original era doble: el endpoint devolvía enums en mayúsculas
 * (`DOG`, `SMALL`) y el formulario usa minúsculas (`dog`, `small`), así que los
 * `<select>` se quedaban vacíos. Además `size` se rellenaba con `medium` aunque
 * no hubiera evidencia, lo que inventaba datos.
 */

describe('extractStructuredDataFromText', () => {
  it('extrae especie, sexo, tamaño, colores, provincia, recompensa y contacto', () => {
    const text = [
      'Se perdió nuestro perro macho mediano, color marrón y blanco.',
      'Fue visto en Pinar del Rio. Recompensa 500 CUP.',
      'Llama al 55512345 o escribe a dueno@example.com.',
    ].join('\n');

    const result = extractStructuredDataFromText(text);

    expect(result.species).toBe('dog');
    expect(result.sex).toBe('male');
    expect(result.size).toBe('medium');
    expect(result.color).toBe('Marrón y Blanco');
    expect(result.province).toBe('Pinar del Río');
    expect(result.reward).toBe('$500');
    expect(result.contactPhone).toBe('+5355512345');
    expect(result.contactWhatsapp).toBe('+5355512345');
    expect(result.contactEmail).toBe('dueno@example.com');
  });

  it('no confunde palabras que contienen "cat" con un gato', () => {
    const result = extractStructuredDataFromText('Categoría: adopción de un perro joven');

    expect(result.species).toBe('dog');
    expect(result.ageApprox).toBe('young');
  });

  it('devuelve la provincia con su nombre canónico aunque falten tildes', () => {
    expect(extractStructuredDataFromText('Perdido en PINAR DEL RIO').province).toBe('Pinar del Río');
    expect(extractStructuredDataFromText('Encontrado en Las Tunas').province).toBe('Las Tunas');
  });

  it('extrae fecha y hora cuando aparecen', () => {
    const result = extractStructuredDataFromText('Se perdió el 12/05/2024 a las 18:30');

    // El formulario usa <input type="date">, que solo acepta YYYY-MM-DD.
    expect(result.eventDate).toBe('2024-05-12');
    expect(result.eventTimeApprox).toBe('18:30');
  });

  it('normaliza fechas escritas y horas con meridiano', () => {
    const result = extractStructuredDataFromText('Se perdió el 12 de mayo de 2024 a las 3:30 pm');

    expect(result.eventDate).toBe('2024-05-12');
    expect(result.eventTimeApprox).toBe('15:30');
  });

  it('extrae el tipo de aviso', () => {
    expect(extractStructuredDataFromText('Se busca perro en La Habana').type).toBe('LOST');
    expect(extractStructuredDataFromText('Perro en adopción').type).toBe('ADOPTION');
    expect(extractStructuredDataFromText('Encontré una gata').type).toBe('FOUND');
  });

  it('extrae provincia, municipio, zona y dirección', () => {
    const result = extractStructuredDataFromText(
      'Perdido en el municipio Centro Habana, reparto Vedado. Calle 23 #456. Llama al 55512345'
    );

    expect(result.province).toBe('La Habana');
    expect(result.municipality).toBe('Centro Habana');
    expect(result.zone).toBe('Vedado');
    expect(result.address).toBe('Calle 23 #456');
  });

  it('no adivina un municipio homónimo sin provincia', () => {
    // "San Luis" existe en Pinar del Río y en Santiago de Cuba: sin más pistas
    // es imposible saber cuál es y no se debe inventar.
    expect(extractStructuredDataFromText('Perdido en San Luis').municipality).toBeUndefined();
  });

  it('no confunde "la playa" con el municipio Playa', () => {
    expect(extractStructuredDataFromText('Se perdió en la playa').municipality).toBeUndefined();
    expect(
      extractStructuredDataFromText('Se perdió en el municipio Playa').municipality
    ).toBe('Playa');
    expect(extractStructuredDataFromText('Se perdió en Playa').municipality).toBe('Playa');
  });

  it('no inventa datos con un texto vacío', () => {
    expect(extractStructuredDataFromText('   ')).toEqual({});
  });
});

describe('extractAttributesFromVision', () => {
  it('detecta especie, color y collar sin rellenar tamaño por defecto', () => {
    const result = extractAttributesFromVision({
      labels: [
        { label: 'Dog', confidence: 0.95 },
        { label: 'Collar', confidence: 0.8 },
        { label: 'Brown', confidence: 0.7 },
      ],
      description: 'Image contains: Dog, Collar, Brown',
    });

    expect(result.species).toBe('dog');
    expect(result.color).toBe('Marrón');
    expect(result.collar).toBe(true);
    expect(result.size).toBeUndefined();
  });

  it('no devuelve nada si las etiquetas no hablan de una mascota', () => {
    const result = extractAttributesFromVision({
      labels: [{ label: 'Car', confidence: 0.9 }],
      description: 'Image contains: Car',
    });

    expect(result.species).toBeUndefined();
  });
});

describe('buildFormExtraction', () => {
  it('combina OCR y visión y deja los enums como los espera el formulario', () => {
    const result = buildFormExtraction({
      ocr: {
        text: 'Perro hembra pequeño se perdió en Holguín. WhatsApp 55512345',
        confidence: 0.95,
      },
      vision: {
        labels: [
          { label: 'Dog', confidence: 0.9 },
          { label: 'White', confidence: 0.8 },
        ],
        description: 'Image contains: Dog, White',
      },
    });

    expect(result.species).toBe('dog');
    expect(result.sex).toBe('female');
    expect(result.size).toBe('small');
    expect(result.color).toBe('Blanco');
    expect(result.province).toBe('Holguín');
    expect(result.contactPhone).toBe('+5355512345');
    expect(result.contactMode).toBe('PHONE');
    expect(result.hasTextOverlay).toBe(true);
    expect(result.confidence).toBeCloseTo(0.9, 5);
  });

  it('usa visión para lo físico y OCR para el contacto', () => {
    const result = buildFormExtraction({
      ocr: { text: 'Escribe a rescate@example.com', confidence: 0.9 },
      vision: {
        labels: [{ label: 'Cat', confidence: 0.9 }],
        description: 'Image contains: Cat',
      },
    });

    expect(result.species).toBe('cat');
    expect(result.contactEmail).toBe('rescate@example.com');
    expect(result.contactMode).toBe('EMAIL');
  });

  it('sin fuentes devuelve confianza 0 y ningún campo inventado', () => {
    const result = buildFormExtraction({});

    expect(result.confidence).toBe(0);
    expect(result.hasTextOverlay).toBe(false);
    expect(result.species).toBeUndefined();
    expect(result.size).toBeUndefined();
    expect(result.contactMode).toBeUndefined();
  });

  it('no marca el modo de contacto si no hay ningún dato de contacto', () => {
    const result = buildFormExtraction({
      vision: { labels: [{ label: 'Dog', confidence: 0.9 }], description: 'Dog' },
    });

    expect(result.contactMode).toBeUndefined();
  });

  it('marca el municipio extraído y devuelve coordenadas utilizables', () => {
    const result = buildFormExtraction({
      ocr: {
        text: 'Perro perdido en Centro Habana, La Habana. Calle 23 #456. Llama al 55512345',
        confidence: 0.9,
      },
    });

    expect(result.type).toBe('LOST');
    expect(result.province).toBe('La Habana');
    expect(result.municipality).toBe('Centro Habana');
    expect(result.locationPrecision).toBe('municipality');
    expect(result.latitude).toBeCloseTo(23.138, 2);
    expect(result.longitude).toBeCloseTo(-82.3618, 2);
    expect(result.address).toBe('Calle 23 #456');
  });

  it('usa la provincia como respaldo cuando no hay municipio', () => {
    const result = buildFormExtraction({
      ocr: { text: 'Gato encontrado en Mayabeque', confidence: 0.8 },
    });

    expect(result.province).toBe('Mayabeque');
    expect(result.municipality).toBeUndefined();
    expect(result.locationPrecision).toBe('province');
    expect(result.latitude).toBeCloseTo(22.9615, 2);
  });

  it('compone título y descripción solo con datos extraídos', () => {
    const result = buildFormExtraction({
      ocr: {
        text: 'Perro macho se perdió en Centro Habana. Color marrón. Llama al 55512345',
        confidence: 0.9,
      },
    });

    expect(result.title).toBe('Perro perdido en Centro Habana');
    expect(result.description).toBeTruthy();
    expect(result.description?.length).toBeGreaterThanOrEqual(20);
  });

  it('respeta el título y la descripción que trae la visión', () => {
    const result = buildFormExtraction({
      vision: {
        labels: [{ label: 'Dog', confidence: 0.9 }],
        description: JSON.stringify({
          title: 'Toby perdido en Playa',
          description: 'Toby se perdió cerca del parque, lleva collar rojo.',
        }),
      },
    });

    expect(result.title).toBe('Toby perdido en Playa');
    expect(result.description).toBe('Toby se perdió cerca del parque, lleva collar rojo.');
  });

  it('traduce el JSON de visión a enums y ubicación del formulario', () => {
    const result = buildFormExtraction({
      vision: {
        labels: [{ label: 'Dog', confidence: 0.9 }],
        description: JSON.stringify({
          type: 'FOUND',
          species: 'Perro',
          size: 'PEQUENO',
          sex: 'HEMBRA',
          province: 'Holguin',
          municipality: 'Guardalavaca',
          zone: 'Playa Guardalavaca',
          event_date: '2024-05-12',
          event_time: '3:30 pm',
          contact_phone: '55512345',
        }),
      },
    });

    expect(result.type).toBe('FOUND');
    expect(result.species).toBe('dog');
    expect(result.size).toBe('small');
    expect(result.sex).toBe('female');
    expect(result.province).toBe('Holguín');
    expect(result.municipality).toBe('Guardalavaca');
    expect(result.eventDate).toBe('2024-05-12');
    expect(result.eventTimeApprox).toBe('15:30');
    expect(result.contactPhone).toBe('+5355512345');
  });
});

describe('parseVisionJson', () => {
  it('acepta JSON envuelto en markdown', () => {
    expect(parseVisionJson('```json\n{"species":"dog"}\n```')).toEqual({ species: 'dog' });
  });

  it('devuelve null cuando no hay JSON', () => {
    expect(parseVisionJson('Image contains: Dog')).toBeNull();
    expect(parseVisionJson(undefined)).toBeNull();
  });
});

describe('resolveCoordinates', () => {
  it('prefiere el municipio sobre la provincia', () => {
    const result = resolveCoordinates({ province: 'La Habana', municipality: 'Centro Habana' });

    expect(result.locationPrecision).toBe('municipality');
    expect(result.latitude).toBeCloseTo(23.138, 2);
    expect(result.longitude).toBeCloseTo(-82.3618, 2);
  });

  it('usa la provincia cuando solo hay provincia', () => {
    const result = resolveCoordinates({ province: 'Pinar del Río' });

    expect(result.locationPrecision).toBe('province');
    expect(result.latitude).toBeCloseTo(22.4167, 2);
  });

  it('no inventa coordenadas sin ubicación', () => {
    expect(resolveCoordinates({})).toEqual({ locationPrecision: 'none' });
  });
});

describe('findMunicipality', () => {
  it('desambigua por provincia', () => {
    expect(findMunicipality('San Luis, Pinar del Rio')).toEqual({
      province: 'Pinar del Río',
      municipality: 'San Luis',
    });
  });

  it('encuentra municipios con tilde aunque el texto no la traiga', () => {
    expect(findMunicipality('Perdido en Sancti Spiritus')).toEqual({
      province: 'Sancti Spíritus',
      municipality: 'Sancti Spíritus',
    });
  });
});

describe('importación desde un enlace de Facebook', () => {
  it('extrae los campos del mensaje del post aunque el Open Graph sea genérico', () => {
    // Caso real: la foto tiene metadatos genéricos, pero el HTML incluye el
    // mensaje del post. Antes se usaba solo el Open Graph y el formulario
    // llegaba vacío.
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Facebook" />
          <meta property="og:description" content="See posts, photos and more on Facebook." />
          <meta property="og:image" content="https://scontent.xx.fbcdn.net/foto.jpg?stp=dst-jpg&amp;oe=6AE3E88C" />
        </head>
        <body>
          <div data-ad-preview="message">
            Perro macho pequeño se perdió en Centro Habana, La Habana.<br />
            Llama al 55512345. Recompensa 500 CUP.
          </div>
        </body>
      </html>
    `;

    const metadata = extractOpenGraphMetadata(html);
    const postText = extractPostText(html);

    expect(metadata.image).toBe('https://scontent.xx.fbcdn.net/foto.jpg?stp=dst-jpg&oe=6AE3E88C');
    expect(isFacebookBoilerplate(metadata.title)).toBe(true);
    expect(isFacebookBoilerplate(metadata.description)).toBe(true);
    expect(postText).toContain('Centro Habana');

    const result = buildFormExtraction({
      ocr: { text: postText ?? '', confidence: 0.6 },
    });

    expect(result.type).toBe('LOST');
    expect(result.species).toBe('dog');
    expect(result.sex).toBe('male');
    expect(result.size).toBe('small');
    expect(result.province).toBe('La Habana');
    expect(result.municipality).toBe('Centro Habana');
    expect(result.contactPhone).toBe('+5355512345');
    expect(result.reward).toBe('$500');
    expect(result.latitude).toBeCloseTo(23.138, 2);
  });
});
