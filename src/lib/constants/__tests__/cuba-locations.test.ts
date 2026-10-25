import { describe, expect, it } from 'vitest';
import {
  distanceKm,
  resolveCubaCoordinates,
} from '../cuba-locations';

describe('resolveCubaCoordinates', () => {
  it('usa el centro del municipio cuando provincia y municipio coinciden', () => {
    const result = resolveCubaCoordinates({
      province: 'La Habana',
      municipality: 'Centro Habana',
    });

    expect(result.locationPrecision).toBe('municipality');
    expect(result.latitude).toBeCloseTo(23.138, 3);
    expect(result.longitude).toBeCloseTo(-82.3618, 3);
  });

  it('ignora tildes y mayúsculas al comparar', () => {
    const result = resolveCubaCoordinates({
      province: 'la habana',
      municipality: 'centro habana',
    });

    expect(result.locationPrecision).toBe('municipality');
    expect(result.latitude).toBeCloseTo(23.138, 3);
  });

  it('resuelve el municipio sin provincia solo si el nombre es único', () => {
    expect(resolveCubaCoordinates({ municipality: 'Centro Habana' }).locationPrecision).toBe(
      'municipality'
    );
    expect(resolveCubaCoordinates({ municipality: 'San Luis' }).locationPrecision).toBe('none');
  });

  it('cae a la provincia cuando el municipio no pertenece a ella', () => {
    const result = resolveCubaCoordinates({
      province: 'La Habana',
      municipality: 'San Luis',
    });

    expect(result.locationPrecision).toBe('province');
    expect(result.latitude).toBeCloseTo(23.0833, 3);
  });

  it('no inventa coordenadas sin ubicación', () => {
    expect(resolveCubaCoordinates({})).toEqual({ locationPrecision: 'none' });
  });
});

describe('distanceKm', () => {
  it('devuelve cero para el mismo punto', () => {
    expect(distanceKm({ lat: 23.138, lng: -82.3618 }, { lat: 23.138, lng: -82.3618 })).toBe(0);
  });

  it('calcula una distancia razonable entre municipios vecinos', () => {
    const distance = distanceKm(
      { lat: 23.138, lng: -82.3618 },
      { lat: 23.1183, lng: -82.3938 }
    );

    expect(distance).toBeGreaterThan(2);
    expect(distance).toBeLessThan(5);
  });
});
