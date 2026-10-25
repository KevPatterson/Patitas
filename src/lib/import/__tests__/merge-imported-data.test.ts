import { describe, expect, it } from 'vitest';
import { mergeImportedData } from '../merge-imported-data';
import type { PublicationFormValues } from '../../validations/publication';

const baseValues: PublicationFormValues = {
  type: 'LOST',
  title: '',
  description: '',
  species: '',
  breed: '',
  sex: '',
  size: '',
  ageApprox: '',
  color: '',
  characteristics: '',
  collar: false,
  plate: false,
  reward: '',
  contactMode: 'INTERNAL',
  contactPhone: '',
  contactWhatsapp: '',
  contactEmail: '',
  microchip: '',
  province: '',
  municipality: '',
  zone: '',
  approximateLat: '',
  approximateLng: '',
  eventDate: '',
  eventTimeApprox: '',
};

describe('mergeImportedData', () => {
  it('rellena los campos vacíos con los datos revisados', () => {
    const result = mergeImportedData(baseValues, {
      type: 'FOUND',
      title: 'Perro encontrado en Vedado',
      description: 'Apareció cerca del parque con collar azul.',
      species: 'dog',
      breed: 'Mestizo',
      color: 'Marrón',
      size: 'medium',
      sex: 'male',
      ageApprox: 'adult',
      characteristics: 'Muy dócil',
      collar: true,
      reward: '$500',
      contactPhone: '+5355512345',
      contactMode: 'PHONE',
      province: 'La Habana',
      municipality: 'Plaza de la Revolución',
      zone: 'Vedado',
      eventDate: '2026-10-20',
      eventTimeApprox: '15:30',
    });

    expect(result).toMatchObject({
      type: 'FOUND',
      title: 'Perro encontrado en Vedado',
      species: 'dog',
      breed: 'Mestizo',
      color: 'Marrón',
      size: 'medium',
      sex: 'male',
      ageApprox: 'adult',
      collar: true,
      reward: '$500',
      contactMode: 'PHONE',
      contactPhone: '+5355512345',
      province: 'La Habana',
      municipality: 'Plaza de la Revolución',
      zone: 'Vedado',
      eventDate: '2026-10-20',
      eventTimeApprox: '15:30',
    });
  });

  it('no pisa lo que el usuario ya escribió', () => {
    const current: PublicationFormValues = {
      ...baseValues,
      type: 'FOUND',
      title: 'Título escrito por el usuario',
      description: 'Descripción que el usuario ya había redactado con calma.',
      species: 'cat',
      color: 'Negro',
      zone: 'Centro Habana',
      contactMode: 'WHATSAPP',
      contactWhatsapp: '+5350000000',
    };

    const result = mergeImportedData(current, {
      type: 'LOST',
      title: 'Título de la IA',
      description: 'Descripción de la IA',
      species: 'dog',
      color: 'Blanco',
      zone: 'Vedado',
      contactMode: 'PHONE',
      contactPhone: '+5355512345',
    });

    // El tipo sí cambia: es la intención del aviso.
    expect(result.type).toBe('LOST');
    expect(result.title).toBe('Título escrito por el usuario');
    expect(result.description).toBe('Descripción que el usuario ya había redactado con calma.');
    expect(result.species).toBe('cat');
    expect(result.color).toBe('Negro');
    expect(result.zone).toBe('Centro Habana');
    expect(result.contactMode).toBe('WHATSAPP');
    expect(result.contactWhatsapp).toBe('+5350000000');
  });

  it('usa la dirección como zona solo si no hay zona', () => {
    const result = mergeImportedData(baseValues, {
      address: 'Calle 23 esquina a 12, Vedado',
    });

    expect(result.zone).toBe('Calle 23 esquina a 12, Vedado');
  });

  it('solo activa collar y placa, nunca los desmarca', () => {
    const current: PublicationFormValues = {
      ...baseValues,
      collar: true,
      plate: true,
    };

    const result = mergeImportedData(current, { collar: false, plate: false });

    expect(result.collar).toBe(true);
    expect(result.plate).toBe(true);
  });

  it('no cambia el modo de contacto elegido por el usuario', () => {
    const current: PublicationFormValues = {
      ...baseValues,
      contactMode: 'EMAIL',
      contactEmail: 'ana@example.com',
    };

    const result = mergeImportedData(current, {
      contactMode: 'PHONE',
      contactPhone: '+5355512345',
    });

    expect(result.contactMode).toBe('EMAIL');
    expect(result.contactEmail).toBe('ana@example.com');
    expect(result.contactPhone).toBe('+5355512345');
  });
});
