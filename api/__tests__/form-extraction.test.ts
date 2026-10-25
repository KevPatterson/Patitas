import { describe, expect, it } from 'vitest';
import {
  buildFormExtraction,
  extractAttributesFromVision,
  extractStructuredDataFromText,
} from '../_lib/ai/form-extraction';

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

    expect(result.eventDate).toBe('12/05/2024');
    expect(result.eventTimeApprox).toBe('18:30');
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
});
