import { describe, expect, it } from 'vitest';
import { geocodeMatchesLocation } from '../location-validation';

const centroHabana = { lat: 23.138, lng: -82.3618 };

describe('geocodeMatchesLocation', () => {
  it('acepta un resultado dentro del municipio esperado', () => {
    expect(
      geocodeMatchesLocation(
        {
          lat: 23.1347,
          lng: -82.3693,
          displayName: 'Centro Habana, La Habana, Cuba',
          city: 'La Habana',
          cityDistrict: 'Centro Habana',
        },
        { province: 'La Habana', municipality: 'Centro Habana', expected: centroHabana }
      )
    ).toBe(true);
  });

  it('rechaza un resultado de otro municipio de la misma provincia', () => {
    expect(
      geocodeMatchesLocation(
        {
          lat: 23.1183,
          lng: -82.3938,
          displayName: 'Vedado, Plaza de la Revolución, La Habana, Cuba',
          cityDistrict: 'Plaza de la Revolución',
        },
        { province: 'La Habana', municipality: 'Centro Habana', expected: centroHabana }
      )
    ).toBe(false);
  });

  it('rechaza un municipio homónimo de otra provincia', () => {
    expect(
      geocodeMatchesLocation(
        {
          lat: 21.121,
          lng: -75.834,
          displayName: 'Playa Guardalavaca, Holguín, Cuba',
          state: 'Holguín',
        },
        { province: 'La Habana', municipality: 'Playa' }
      )
    ).toBe(false);
  });

  it('rechaza un resultado demasiado lejos aunque el nombre coincida', () => {
    expect(
      geocodeMatchesLocation(
        {
          lat: 24.5,
          lng: -82.3618,
          displayName: 'Centro Habana, La Habana, Cuba',
        },
        { province: 'La Habana', municipality: 'Centro Habana', expected: centroHabana }
      )
    ).toBe(false);
  });

  it('acepta la provincia cuando no hay municipio', () => {
    expect(
      geocodeMatchesLocation(
        { lat: 22.9615, lng: -82.1472, displayName: 'Mayabeque, Cuba', state: 'Mayabeque' },
        { province: 'Mayabeque' }
      )
    ).toBe(true);
  });

  it('no puede validar sin ubicación y no descarta el resultado', () => {
    expect(geocodeMatchesLocation({ lat: 23.1, lng: -82.3 }, {})).toBe(true);
  });
});
