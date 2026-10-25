import {
  distanceKm,
  normalizeLocationName,
  type Coordinates,
} from '../constants/cuba-locations';

/**
 * Margen de seguridad para un resultado del geocodificador.
 *
 * La comprobación principal es que el nombre del municipio (o de la provincia)
 * aparezca en la jerarquía que devuelve Nominatim. La distancia solo descarta
 * resultados absurdos, así que se deja amplia para no rechazar direcciones
 * válidas en municipios rurales grandes.
 */
export const MAX_GEOCODE_DISTANCE_KM = 50;

export type GeocodeCandidate = Coordinates & {
  displayName?: string;
  state?: string;
  county?: string;
  city?: string;
  cityDistrict?: string;
  suburb?: string;
  town?: string;
  village?: string;
  municipality?: string;
};

/**
 * Indica si un resultado de Nominatim pertenece a la ubicación esperada.
 *
 * Sin esta validación, una calle con el mismo nombre en otra provincia podía
 * sustituir el centro del municipio y el mapa marcaba un punto totalmente
 * distinto al del aviso.
 */
export function geocodeMatchesLocation(
  candidate: GeocodeCandidate,
  input: { province?: string; municipality?: string; expected?: Coordinates }
): boolean {
  if (input.expected && distanceKm(candidate, input.expected) > MAX_GEOCODE_DISTANCE_KM) {
    return false;
  }

  const municipality = normalizeLocationName(input.municipality ?? '');
  const province = normalizeLocationName(input.province ?? '');

  if (!municipality && !province) return true;

  const haystack = [
    candidate.displayName,
    candidate.state,
    candidate.county,
    candidate.city,
    candidate.cityDistrict,
    candidate.suburb,
    candidate.town,
    candidate.village,
    candidate.municipality,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeLocationName)
    .join(' | ');

  if (municipality && !haystack.includes(municipality)) return false;
  if (province && !haystack.includes(province)) return false;

  return true;
}
