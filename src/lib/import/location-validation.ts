import {
  distanceKm,
  findMunicipalityCoordinates,
  findMunicipalityName,
  findProvinceName,
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
 * Traduce la jerarquía de Nominatim a los nombres canónicos del formulario.
 *
 * El geocodificador devuelve el estado y el condado con variantes ("Provincia
 * de La Habana", "Habana"), y a veces el municipio solo aparece en `city` o
 * `town`. Canonicalizarlo permite rellenar provincia y municipio cuando el aviso
 * solo traía una zona o una dirección.
 */
export function canonicalizeGeocodeLocation(candidate: GeocodeCandidate): {
  province?: string;
  municipality?: string;
} {
  let province =
    findProvinceName(candidate.state) ??
    findProvinceName(candidate.county) ??
    findProvinceName(candidate.displayName);

  const municipalityValues = [
    candidate.municipality,
    candidate.county,
    candidate.city,
    candidate.town,
    candidate.cityDistrict,
    candidate.suburb,
    candidate.village,
  ].filter((value): value is string => Boolean(value));

  let municipality: string | undefined;

  for (const value of municipalityValues) {
    municipality = findMunicipalityName(province, value);
    if (municipality) break;
  }

  // Si la provincia no se pudo identificar, se intenta con el nombre único.
  if (!municipality) {
    for (const value of municipalityValues) {
      municipality = findMunicipalityName(undefined, value);
      if (municipality) break;
    }
  }

  // Una provincia deducible del municipio permite completar ambos campos.
  if (municipality && !province) {
    province = findMunicipalityCoordinates(undefined, municipality)?.province;
  }

  return { province, municipality };
}

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

  const canonical = canonicalizeGeocodeLocation(candidate);
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

  const municipalityMatches = municipality
    ? haystack.includes(municipality) ||
      normalizeLocationName(canonical.municipality ?? '') === municipality
    : true;
  const provinceMatches = province
    ? haystack.includes(province) ||
      normalizeLocationName(canonical.province ?? '') === province
    : true;

  return municipalityMatches && provinceMatches;
}
