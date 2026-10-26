import { describe, expect, it } from 'vitest';
import {
  distanceKm,
  findCubaZone,
  findMunicipalityName,
  findProvinceName,
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

  it('usa la zona cuando es más precisa que el municipio', () => {
    const result = resolveCubaCoordinates({
      province: 'La Habana',
      municipality: 'Plaza de la Revolución',
      zone: 'Vedado',
    });

    expect(result.locationPrecision).toBe('zone');
    expect(result.latitude).toBeCloseTo(23.1367, 3);
    expect(result.longitude).toBeCloseTo(-82.3833, 3);
  });

  it('descarta la zona si contradice el municipio elegido', () => {
    const result = resolveCubaCoordinates({
      province: 'La Habana',
      municipality: 'Centro Habana',
      zone: 'Miramar',
    });

    expect(result.locationPrecision).toBe('municipality');
    expect(result.latitude).toBeCloseTo(23.138, 3);
  });

  it('no repite una zona que se llama igual que el municipio', () => {
    const result = resolveCubaCoordinates({
      province: 'Holguín',
      municipality: 'Guardalavaca',
      zone: 'Playa Guardalavaca',
    });

    expect(result.locationPrecision).toBe('municipality');
    expect(result.latitude).toBeCloseTo(21.121, 3);
  });
});

describe('findCubaZone', () => {
  it('prefiere la coincidencia más larga', () => {
    expect(findCubaZone('Perdido en Nuevo Vedado')?.name).toBe('Nuevo Vedado');
    expect(findCubaZone('Perdido en Vedado')?.name).toBe('Vedado');
  });

  it('reconoce alias sin tildes ni mayúsculas', () => {
    expect(findCubaZone('Se perdió cerca del MALECON')?.name).toBe('Malecón');
  });

  it('prioriza la zona que coincide con el contexto', () => {
    const zone = findCubaZone('Santa Fe', {
      province: 'La Habana',
      municipality: 'Playa',
    });

    expect(zone?.name).toBe('Santa Fe');
    expect(zone?.municipality).toBe('Playa');
  });

  it('devuelve undefined cuando no hay zonas conocidas', () => {
    expect(findCubaZone('Perdido en un pueblo sin nombre')).toBeUndefined();
  });
});

describe('búsqueda de nombres canónicos', () => {
  it('reconoce variantes del nombre de la provincia', () => {
    expect(findProvinceName('Provincia de La Habana')).toBe('La Habana');
    expect(findProvinceName('Habana')).toBe('La Habana');
  });

  it('identifica el municipio dentro de la provincia indicada', () => {
    expect(findMunicipalityName('La Habana', 'Plaza de la Revolución')).toBe(
      'Plaza de la Revolución'
    );
  });

  it('no resuelve un municipio homónimo sin provincia', () => {
    expect(findMunicipalityName(undefined, 'San Luis')).toBeUndefined();
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
