/**
 * Coordenadas de referencia de provincias y municipios de Cuba.
 *
 * Se usan para marcar en el mapa la ubicación que la IA extrae de una foto:
 * si el aviso solo dice el municipio, el marcador cae en su centro; si dice
 * una dirección, el cliente intenta geocodificarla para afinar.
 *
 * El módulo vive en `src` para que lo compartan el formulario y las funciones
 * de Vercel: las coordenadas deben calcularse con la misma tabla en ambos
 * lados. Si el cliente recalcula al revisar la ubicación, el marcador no puede
 * quedarse con las coordenadas de un municipio anterior.
 *
 * Fuente: GeoNames (https://www.geonames.org/), licencia CC BY 4.0.
 * Generado a partir de CU.txt (feature codes ADM1 y ADM2).
 */

export type Coordinates = { lat: number; lng: number };

export const PROVINCE_COORDINATES: Record<string, Coordinates> = {
  "Pinar del Río": { lat: 22.4167, lng: -83.8333 },
  "Artemisa": { lat: 22.8140, lng: -82.7561 },
  "La Habana": { lat: 23.0833, lng: -82.3000 },
  "Mayabeque": { lat: 22.9615, lng: -82.1472 },
  "Matanzas": { lat: 22.6667, lng: -81.1667 },
  "Villa Clara": { lat: 22.5667, lng: -80.0000 },
  "Cienfuegos": { lat: 22.2667, lng: -80.4500 },
  "Sancti Spíritus": { lat: 21.9167, lng: -79.4167 },
  "Ciego de Ávila": { lat: 21.9667, lng: -78.6333 },
  "Camagüey": { lat: 21.3500, lng: -77.8500 },
  "Las Tunas": { lat: 21.1000, lng: -76.9000 },
  "Holguín": { lat: 20.7500, lng: -75.9167 },
  "Granma": { lat: 20.2833, lng: -76.8667 },
  "Santiago de Cuba": { lat: 20.2000, lng: -75.9333 },
  "Guantánamo": { lat: 20.2167, lng: -74.8667 },
  "Isla de la Juventud": { lat: 21.7000, lng: -82.8167 },
};

export const MUNICIPALITY_COORDINATES: Record<string, Coordinates> = {
  "Pinar del Río|Pinar del Río": { lat: 22.3649, lng: -83.6290 },
  "Pinar del Río|Consolación del Sur": { lat: 22.4413, lng: -83.4399 },
  "Pinar del Río|Viñales": { lat: 22.6177, lng: -83.7220 },
  "Pinar del Río|San Luis": { lat: 22.2441, lng: -83.7177 },
  "Pinar del Río|Sandino": { lat: 22.0803, lng: -84.2060 },
  "Pinar del Río|Guane": { lat: 22.2603, lng: -84.0666 },
  "Pinar del Río|La Palma": { lat: 22.7458, lng: -83.5096 },
  "Pinar del Río|Los Palacios": { lat: 22.5232, lng: -83.2503 },
  "Pinar del Río|San Juan y Martínez": { lat: 22.2917, lng: -83.8709 },
  "Pinar del Río|Minas de Matahambre": { lat: 22.5845, lng: -83.9469 },
  "Pinar del Río|Mantua": { lat: 22.3396, lng: -84.2593 },
  "Artemisa|Artemisa": { lat: 22.7828, lng: -82.8166 },
  "Artemisa|Güira de Melena": { lat: 22.7459, lng: -82.4917 },
  "Artemisa|San Antonio de los Baños": { lat: 22.8852, lng: -82.5043 },
  "Artemisa|Caimito": { lat: 22.9500, lng: -82.6000 },
  "Artemisa|Bauta": { lat: 22.9869, lng: -82.5224 },
  "Artemisa|Mariel": { lat: 22.9766, lng: -82.8157 },
  "Artemisa|Guanajay": { lat: 22.9089, lng: -82.7286 },
  "Artemisa|Candelaria": { lat: 22.7398, lng: -82.9726 },
  "Artemisa|Bahía Honda": { lat: 22.9046, lng: -83.1660 },
  "Artemisa|Alquízar": { lat: 22.7621, lng: -82.6058 },
  "Artemisa|San Cristóbal": { lat: 22.7145, lng: -83.0456 },
  "La Habana|Playa": { lat: 23.0993, lng: -82.4484 },
  "La Habana|Plaza de la Revolución": { lat: 23.1183, lng: -82.3938 },
  "La Habana|Centro Habana": { lat: 23.1380, lng: -82.3618 },
  "La Habana|Habana Vieja": { lat: 23.1298, lng: -82.3517 },
  "La Habana|Cerro": { lat: 23.1104, lng: -82.3799 },
  "La Habana|Diez de Octubre": { lat: 23.0804, lng: -82.3518 },
  "La Habana|Boyeros": { lat: 23.0043, lng: -82.3943 },
  "La Habana|Arroyo Naranjo": { lat: 23.0177, lng: -82.3265 },
  "La Habana|Marianao": { lat: 23.0668, lng: -82.4223 },
  "La Habana|La Lisa": { lat: 23.0319, lng: -82.4615 },
  "La Habana|Guanabacoa": { lat: 23.0755, lng: -82.2921 },
  "La Habana|Regla": { lat: 23.1230, lng: -82.3300 },
  "La Habana|San Miguel del Padrón": { lat: 23.0800, lng: -82.2340 },
  "La Habana|Cotorro": { lat: 23.0146, lng: -82.2391 },
  "La Habana|Habana del Este": { lat: 23.1582, lng: -82.3255 },
  "Mayabeque|San José de las Lajas": { lat: 22.9365, lng: -82.1523 },
  "Mayabeque|Bejucal": { lat: 22.9124, lng: -82.3440 },
  "Mayabeque|Santa Cruz del Norte": { lat: 23.1106, lng: -81.8475 },
  "Mayabeque|Jaruco": { lat: 23.0616, lng: -82.0022 },
  "Mayabeque|Madruga": { lat: 22.9471, lng: -81.8158 },
  "Mayabeque|Güines": { lat: 22.8038, lng: -82.0039 },
  "Mayabeque|San Nicolás": { lat: 22.7539, lng: -81.8971 },
  "Mayabeque|Nueva Paz": { lat: 22.7198, lng: -81.7244 },
  "Mayabeque|Batabanó": { lat: 22.7331, lng: -82.2941 },
  "Mayabeque|Melena del Sur": { lat: 22.7882, lng: -82.1511 },
  "Mayabeque|Quivicán": { lat: 22.8185, lng: -82.3861 },
  "Matanzas|Matanzas": { lat: 23.0750, lng: -81.5792 },
  "Matanzas|Varadero": { lat: 23.1568, lng: -81.2444 },
  "Matanzas|Cárdenas": { lat: 23.0162, lng: -81.2358 },
  "Matanzas|Colón": { lat: 22.7485, lng: -80.8779 },
  "Matanzas|Jovellanos": { lat: 22.8362, lng: -81.2274 },
  "Matanzas|Limonar": { lat: 22.9426, lng: -81.4728 },
  "Matanzas|Los Arabos": { lat: 22.6409, lng: -80.6570 },
  "Matanzas|Martí": { lat: 22.9831, lng: -80.8566 },
  "Matanzas|Pedro Betancourt": { lat: 22.7839, lng: -81.4270 },
  "Matanzas|Perico": { lat: 22.8367, lng: -81.0299 },
  "Matanzas|Unión de Reyes": { lat: 22.7277, lng: -81.5397 },
  "Matanzas|Calimete": { lat: 22.5336, lng: -80.9096 },
  "Matanzas|Ciénaga de Zapata": { lat: 22.3993, lng: -81.5739 },
  "Matanzas|Jagüey Grande": { lat: 22.5889, lng: -81.1221 },
  "Villa Clara|Santa Clara": { lat: 22.4219, lng: -79.9202 },
  "Villa Clara|Remedios": { lat: 22.3804, lng: -79.4995 },
  "Villa Clara|Caibarién": { lat: 22.4789, lng: -79.4596 },
  "Villa Clara|Camajuaní": { lat: 22.5159, lng: -79.7085 },
  "Villa Clara|Cifuentes": { lat: 22.6400, lng: -80.1000 },
  "Villa Clara|Corralillo": { lat: 22.8869, lng: -80.5359 },
  "Villa Clara|Encrucijada": { lat: 22.6915, lng: -79.8236 },
  "Villa Clara|Manicaragua": { lat: 22.1464, lng: -79.9758 },
  "Villa Clara|Placetas": { lat: 22.2702, lng: -79.6719 },
  "Villa Clara|Quemado de Güines": { lat: 22.8023, lng: -80.2826 },
  "Villa Clara|Ranchuelo": { lat: 22.4058, lng: -80.1259 },
  "Villa Clara|Sagua la Grande": { lat: 22.8356, lng: -80.0859 },
  "Villa Clara|Santo Domingo": { lat: 22.6438, lng: -80.3562 },
  "Cienfuegos|Cienfuegos": { lat: 22.1358, lng: -80.4098 },
  "Cienfuegos|Cruces": { lat: 22.2954, lng: -80.2191 },
  "Cienfuegos|Cumanayagua": { lat: 22.1498, lng: -80.1991 },
  "Cienfuegos|Palmira": { lat: 22.2855, lng: -80.3800 },
  "Cienfuegos|Rodas": { lat: 22.3985, lng: -80.5474 },
  "Cienfuegos|Aguada de Pasajeros": { lat: 22.3970, lng: -80.8470 },
  "Cienfuegos|Abreus": { lat: 22.2087, lng: -80.6565 },
  "Cienfuegos|Lajas": { lat: 22.4167, lng: -80.3000 },
  "Sancti Spíritus|Sancti Spíritus": { lat: 21.8335, lng: -79.4930 },
  "Sancti Spíritus|Trinidad": { lat: 21.8510, lng: -79.8576 },
  "Sancti Spíritus|Cabaiguán": { lat: 22.1183, lng: -79.4776 },
  "Sancti Spíritus|Fomento": { lat: 22.0514, lng: -79.6914 },
  "Sancti Spíritus|Jatibonico": { lat: 21.9396, lng: -79.1275 },
  "Sancti Spíritus|La Sierpe": { lat: 21.7711, lng: -79.2681 },
  "Sancti Spíritus|Taguasco": { lat: 22.0421, lng: -79.2876 },
  "Sancti Spíritus|Yaguajay": { lat: 22.2832, lng: -79.1652 },
  "Ciego de Ávila|Ciego de Ávila": { lat: 21.8710, lng: -78.7551 },
  "Ciego de Ávila|Morón": { lat: 22.1988, lng: -78.6113 },
  "Ciego de Ávila|Chambas": { lat: 22.1967, lng: -78.9133 },
  "Ciego de Ávila|Ciro Redondo": { lat: 22.0189, lng: -78.7031 },
  "Ciego de Ávila|Florencia": { lat: 22.1452, lng: -78.9732 },
  "Ciego de Ávila|Majagua": { lat: 21.8785, lng: -78.9781 },
  "Ciego de Ávila|Baraguá": { lat: 21.6819, lng: -78.6244 },
  "Ciego de Ávila|Bolivia": { lat: 22.0775, lng: -78.3442 },
  "Ciego de Ávila|Primero de Enero": { lat: 21.9450, lng: -78.4331 },
  "Ciego de Ávila|Venezuela": { lat: 21.7081, lng: -78.8033 },
  "Camagüey|Camagüey": { lat: 21.4338, lng: -77.9183 },
  "Camagüey|Florida": { lat: 21.4206, lng: -78.3159 },
  "Camagüey|Nuevitas": { lat: 21.3896, lng: -77.2180 },
  "Camagüey|Guáimaro": { lat: 21.1629, lng: -77.3422 },
  "Camagüey|Céspedes": { lat: 21.6705, lng: -78.2823 },
  "Camagüey|Esmeralda": { lat: 21.8360, lng: -78.0016 },
  "Camagüey|Sibanicú": { lat: 21.2357, lng: -77.5241 },
  "Camagüey|Minas": { lat: 21.4875, lng: -77.6103 },
  "Camagüey|Najasa": { lat: 21.0721, lng: -77.7468 },
  "Camagüey|Santa Cruz del Sur": { lat: 20.8599, lng: -77.9887 },
  "Camagüey|Vertientes": { lat: 21.2632, lng: -78.1513 },
  "Camagüey|Jimaguayú": { lat: 21.2427, lng: -77.8244 },
  "Camagüey|Sierra de Cubitas": { lat: 21.7045, lng: -77.7892 },
  "Las Tunas|Las Tunas": { lat: 20.9804, lng: -77.0352 },
  "Las Tunas|Puerto Padre": { lat: 21.1816, lng: -76.7197 },
  "Las Tunas|Jesús Menéndez": { lat: 21.1633, lng: -76.4775 },
  "Las Tunas|Majibacoa": { lat: 20.9419, lng: -76.7178 },
  "Las Tunas|Manatí": { lat: 21.3144, lng: -76.9378 },
  "Las Tunas|Colombia": { lat: 20.9862, lng: -77.4231 },
  "Las Tunas|Amancio": { lat: 20.8199, lng: -77.5759 },
  "Las Tunas|Jobabo": { lat: 20.9078, lng: -77.2831 },
  "Holguín|Holguín": { lat: 20.8994, lng: -76.2942 },
  "Holguín|Gibara": { lat: 21.0892, lng: -76.2780 },
  "Holguín|Banes": { lat: 20.9646, lng: -75.7544 },
  "Holguín|Moa": { lat: 20.6578, lng: -74.9482 },
  "Holguín|Mayarí": { lat: 20.5648, lng: -75.6904 },
  "Holguín|Sagua de Tánamo": { lat: 20.5260, lng: -75.2357 },
  "Holguín|Guardalavaca": { lat: 21.1210, lng: -75.8340 },
  "Holguín|Rafael Freyre": { lat: 21.0293, lng: -75.9989 },
  "Holguín|Antilla": { lat: 20.8474, lng: -75.6734 },
  "Holguín|Báguanos": { lat: 20.7504, lng: -76.0267 },
  "Holguín|Cacocum": { lat: 20.7410, lng: -76.4519 },
  "Holguín|Calixto García": { lat: 20.8432, lng: -76.5909 },
  "Holguín|Cueto": { lat: 20.6476, lng: -75.9327 },
  "Holguín|Frank País": { lat: 20.6559, lng: -75.2624 },
  "Holguín|Urbano Noris": { lat: 20.5975, lng: -76.1383 },
  "Granma|Bayamo": { lat: 20.4039, lng: -76.6733 },
  "Granma|Manzanillo": { lat: 20.2490, lng: -77.0950 },
  "Granma|Jiguaní": { lat: 20.4087, lng: -76.3909 },
  "Granma|Yara": { lat: 20.2733, lng: -76.9543 },
  "Granma|Niquero": { lat: 19.9448, lng: -77.5698 },
  "Granma|Pilón": { lat: 19.9034, lng: -77.3249 },
  "Granma|Media Luna": { lat: 20.1426, lng: -77.4319 },
  "Granma|Río Cauto": { lat: 20.5636, lng: -76.9172 },
  "Granma|Cauto Cristo": { lat: 20.5561, lng: -76.4706 },
  "Granma|Bartolomé Masó": { lat: 20.1661, lng: -76.9458 },
  "Granma|Buey Arriba": { lat: 20.1736, lng: -76.7590 },
  "Granma|Campechuela": { lat: 20.1173, lng: -77.2271 },
  "Granma|Guisa": { lat: 20.2542, lng: -76.5396 },
  "Santiago de Cuba|Santiago de Cuba": { lat: 20.0404, lng: -75.7238 },
  "Santiago de Cuba|Palma Soriano": { lat: 20.2111, lng: -76.0480 },
  "Santiago de Cuba|Contramaestre": { lat: 20.2916, lng: -76.2388 },
  "Santiago de Cuba|San Luis": { lat: 20.2774, lng: -75.7939 },
  "Santiago de Cuba|Songo-La Maya": { lat: 20.1639, lng: -75.6977 },
  "Santiago de Cuba|Tercer Frente": { lat: 20.1590, lng: -76.3097 },
  "Santiago de Cuba|Guamá": { lat: 19.9696, lng: -76.4383 },
  "Santiago de Cuba|Julio Antonio Mella": { lat: 20.3663, lng: -75.9099 },
  "Santiago de Cuba|Segundo Frente": { lat: 20.4128, lng: -75.4965 },
  "Guantánamo|Guantánamo": { lat: 20.1019, lng: -75.1615 },
  "Guantánamo|Baracoa": { lat: 20.3392, lng: -74.5713 },
  "Guantánamo|Maisí": { lat: 20.2473, lng: -74.1487 },
  "Guantánamo|Imías": { lat: 20.0685, lng: -74.6275 },
  "Guantánamo|San Antonio del Sur": { lat: 20.0556, lng: -74.8075 },
  "Guantánamo|Caimanera": { lat: 19.9897, lng: -75.1518 },
  "Guantánamo|El Salvador": { lat: 20.2189, lng: -75.2299 },
  "Guantánamo|Niceto Pérez": { lat: 20.0863, lng: -75.3064 },
  "Guantánamo|Yateras": { lat: 20.3623, lng: -74.9119 },
  "Guantánamo|Manuel Tames": { lat: 20.1787, lng: -75.0552 },
  "Isla de la Juventud|Nueva Gerona": { lat: 21.8876, lng: -82.8066 },
  "Isla de la Juventud|La Fe": { lat: 21.7418, lng: -82.7559 },
};

export type LocationPrecision = 'zone' | 'municipality' | 'province' | 'none';

/** Normaliza un nombre para comparar sin tildes ni mayúsculas. */
export function normalizeLocationName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Alias de provincias que usan el geocodificador o los propios avisos.
 * `Habana` a secas es la forma habitual de nombrar la provincia.
 */
const PROVINCE_NAME_ALIASES: Record<string, string> = {
  habana: 'La Habana',
  'ciudad de la habana': 'La Habana',
  'la habana': 'La Habana',
  'isla de pinos': 'Isla de la Juventud',
  'victoria de las tunas': 'Las Tunas',
};

/**
 * Devuelve la provincia canónica si `value` es (o contiene) su nombre.
 *
 * Nominatim devuelve el estado como "La Habana", "Provincia de La Habana" o
 * incluso "Habana"; sin esta normalización, el resultado se descartaba y el
 * marcador se quedaba en el centro del municipio.
 */
export function findProvinceName(value?: string): string | undefined {
  const target = normalizeLocationName(value ?? '');
  if (!target) return undefined;

  const alias = PROVINCE_NAME_ALIASES[target];
  if (alias) return alias;

  const provinces = Object.keys(PROVINCE_COORDINATES);

  for (const province of provinces) {
    if (normalizeLocationName(province) === target) return province;
  }

  // "Provincia de Pinar del Río", "La Habana, Cuba", etc. Se exige que el
  // nombre aparezca como palabra completa para no confundir calles.
  for (const province of provinces) {
    const normalized = normalizeLocationName(province);
    const pattern = new RegExp(`(?:^|[^a-z0-9])${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`);

    if (pattern.test(target)) return province;
  }

  return undefined;
}

/**
 * Devuelve el municipio canónico a partir del nombre que da Nominatim.
 *
 * Si se conoce la provincia, la búsqueda se limita a ella. Sin provincia solo
 * se resuelve cuando el nombre es único: hay municipios homónimos y elegir uno
 * al azar pondría el marcador en otra provincia.
 */
export function findMunicipalityName(province?: string, value?: string): string | undefined {
  const raw = (value ?? '').split(',')[0] ?? '';
  const target = normalizeLocationName(raw).replace(/^municipio (?:de )?/, '');
  if (!target) return undefined;

  const provinceName = findProvinceName(province);
  const matches: string[] = [];

  for (const key of Object.keys(MUNICIPALITY_COORDINATES)) {
    const separator = key.indexOf('|');
    const entryProvince = key.slice(0, separator);
    const municipality = key.slice(separator + 1);

    if (provinceName && entryProvince !== provinceName) continue;
    if (normalizeLocationName(municipality) === target) {
      matches.push(municipality);
    }
  }

  if (matches.length === 0) return undefined;
  if (provinceName) return matches[0];
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Busca las coordenadas canónicas de un municipio.
 *
 * Si no se indica la provincia solo se resuelve cuando el nombre es único:
 * hay municipios homónimos (por ejemplo, San Luis en Pinar del Río y en
 * Santiago de Cuba) y adivinar uno de ellos marcaría el mapa en otra provincia.
 */
export function findMunicipalityCoordinates(
  province?: string,
  municipality?: string
): { province: string; municipality: string; coordinates: Coordinates } | undefined {
  const target = normalizeLocationName(municipality ?? '');
  if (!target) return undefined;

  const entries = Object.entries(MUNICIPALITY_COORDINATES)
    .map(([key, coordinates]) => {
      const separator = key.indexOf('|');
      return {
        province: key.slice(0, separator),
        municipality: key.slice(separator + 1),
        coordinates,
      };
    })
    .filter((entry) => normalizeLocationName(entry.municipality) === target);

  if (entries.length === 0) return undefined;

  if (province) {
    const normalizedProvince = normalizeLocationName(province);
    return entries.find(
      (entry) => normalizeLocationName(entry.province) === normalizedProvince
    );
  }

  return entries.length === 1 ? entries[0] : undefined;
}

/**
 * Resuelve el punto base de una ubicación: municipio si existe, provincia si no.
 *
 * Es la misma regla que aplica el servidor al extraer un aviso, pero aquí se
 * recalcula con la ubicación que el usuario dejó en la revisión. Así, si
 * corrige el municipio, el marcador no conserva las coordenadas anteriores.
 */
export function resolveCubaCoordinates(input: {
  province?: string;
  municipality?: string;
  /** Reparto, barrio o referencia leída por la IA. */
  zone?: string;
}): { latitude?: number; longitude?: number; locationPrecision: LocationPrecision } {
  const municipality = findMunicipalityCoordinates(input.province, input.municipality);
  const effectiveProvince = municipality?.province ?? input.province;
  const effectiveMunicipality = municipality?.municipality ?? input.municipality;

  // Una zona conocida (Vedado, Miramar, Varadero) es más precisa que el centro
  // del municipio. Solo se usa si no contradice la ubicación elegida: así,
  // cambiar el municipio no deja el marcador en una zona del municipio anterior.
  const zone = input.zone
    ? findCubaZone(input.zone, {
        province: effectiveProvince,
        municipality: effectiveMunicipality,
      })
    : undefined;

  if (
    zone &&
    zoneMatchesContext(zone, {
      province: effectiveProvince,
      municipality: effectiveMunicipality,
    }) &&
    !sameZoneName(zone.name, effectiveMunicipality)
  ) {
    return {
      latitude: zone.lat,
      longitude: zone.lng,
      locationPrecision: 'zone',
    };
  }

  if (municipality) {
    return {
      latitude: municipality.coordinates.lat,
      longitude: municipality.coordinates.lng,
      locationPrecision: 'municipality',
    };
  }

  const provinceName = input.province
    ? Object.keys(PROVINCE_COORDINATES).find(
        (name) => normalizeLocationName(name) === normalizeLocationName(input.province ?? '')
      )
    : undefined;

  if (provinceName) {
    const coordinates = PROVINCE_COORDINATES[provinceName];
    return {
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      locationPrecision: 'province',
    };
  }

  return { locationPrecision: 'none' };
}

/** Distancia aproximada en kilómetros entre dos coordenadas. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

// ---------------------------------------------------------------------------
// Zonas, repartos y puntos de referencia
// ---------------------------------------------------------------------------

/**
 * Zonas, repartos y puntos de referencia frecuentes en los avisos de mascotas.
 *
 * El municipio solo alcanza para poner el marcador en el centro del término
 * municipal. Cuando el aviso dice "Vedado", "cerca del malecón" o "Playa
 * Guardalavaca", esa referencia es más útil que el centro del municipio. Estas
 * coordenadas son aproximadas y sirven solo como punto de partida: el cliente
 * intenta afinar con el geocodificador y valida que el resultado siga dentro de
 * la provincia y el municipio.
 *
 * Se evitan las zonas cuyo nombre coincide con el de un municipio (Centro
 * Habana, Marianao, etc.): en esos casos la precisión municipal ya es correcta y
 * duplicarlas solo confundiría.
 */
export type CubaZone = {
  name: string;
  province: string;
  municipality: string;
  lat: number;
  lng: number;
  aliases?: string[];
};

export type CubaZoneContext = {
  province?: string;
  municipality?: string;
};

export const CUBA_ZONES: CubaZone[] = [
  // La Habana
  { name: 'Vedado', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1367, lng: -82.3833, aliases: ['el vedado'] },
  { name: 'Nuevo Vedado', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1167, lng: -82.4000 },
  { name: 'La Rampa', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1400, lng: -82.3833 },
  { name: 'Coppelia', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1400, lng: -82.3833 },
  { name: 'Hotel Nacional', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1422, lng: -82.3833 },
  { name: 'Universidad de La Habana', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1367, lng: -82.3833, aliases: ['universidad de la habana'] },
  { name: 'José Martí', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1222, lng: -82.3864, aliases: ['memorial jose marti'] },
  { name: 'Cementerio de Colón', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1250, lng: -82.3833, aliases: ['cementerio de colon'] },
  { name: 'Fábrica de Arte Cubano', province: 'La Habana', municipality: 'Plaza de la Revolución', lat: 23.1333, lng: -82.4000, aliases: ['fabrica de arte cubano', 'fac'] },
  { name: 'Miramar', province: 'La Habana', municipality: 'Playa', lat: 23.1136, lng: -82.4236 },
  { name: 'Buenavista', province: 'La Habana', municipality: 'Playa', lat: 23.1167, lng: -82.4333 },
  { name: 'Cubanacán', province: 'La Habana', municipality: 'Playa', lat: 23.1000, lng: -82.4333, aliases: ['cubanacan'] },
  { name: 'Kohly', province: 'La Habana', municipality: 'Playa', lat: 23.1167, lng: -82.4167 },
  { name: 'Santa Fe', province: 'La Habana', municipality: 'Playa', lat: 23.0833, lng: -82.4667 },
  { name: 'Jaimanitas', province: 'La Habana', municipality: 'Playa', lat: 23.1000, lng: -82.4833 },
  { name: 'Siboney', province: 'La Habana', municipality: 'Playa', lat: 23.0833, lng: -82.4667 },
  { name: 'Malecón', province: 'La Habana', municipality: 'Centro Habana', lat: 23.1417, lng: -82.3667, aliases: ['el malecon'] },
  { name: 'Prado', province: 'La Habana', municipality: 'Centro Habana', lat: 23.1386, lng: -82.3650 },
  { name: 'Callejón de Hamel', province: 'La Habana', municipality: 'Centro Habana', lat: 23.1333, lng: -82.3667, aliases: ['callejon de hamel'] },
  { name: 'Parque Central', province: 'La Habana', municipality: 'Habana Vieja', lat: 23.1386, lng: -82.3589 },
  { name: 'Capitolio', province: 'La Habana', municipality: 'Habana Vieja', lat: 23.1352, lng: -82.3597 },
  { name: 'Plaza Vieja', province: 'La Habana', municipality: 'Habana Vieja', lat: 23.1355, lng: -82.3500 },
  { name: 'Catedral de La Habana', province: 'La Habana', municipality: 'Habana Vieja', lat: 23.1400, lng: -82.3500, aliases: ['catedral'] },
  { name: 'Castillo del Morro', province: 'La Habana', municipality: 'Habana del Este', lat: 23.1500, lng: -82.3500, aliases: ['el morro'] },
  { name: 'La Cabaña', province: 'La Habana', municipality: 'Habana del Este', lat: 23.1450, lng: -82.3500, aliases: ['la cabana'] },
  { name: 'Alamar', province: 'La Habana', municipality: 'Habana del Este', lat: 23.1500, lng: -82.3000 },
  { name: 'Cojímar', province: 'La Habana', municipality: 'Habana del Este', lat: 23.1667, lng: -82.3000, aliases: ['cojimar'] },
  { name: 'Guanabo', province: 'La Habana', municipality: 'Habana del Este', lat: 23.1667, lng: -82.2833 },
  { name: 'Santa María del Mar', province: 'La Habana', municipality: 'Habana del Este', lat: 23.1667, lng: -82.2833, aliases: ['santa maria del mar'] },
  { name: 'Playas del Este', province: 'La Habana', municipality: 'Habana del Este', lat: 23.1667, lng: -82.2833, aliases: ['playa del este'] },
  { name: 'Santos Suárez', province: 'La Habana', municipality: 'Diez de Octubre', lat: 23.0925, lng: -82.3679, aliases: ['santos suarez'] },
  { name: 'Luyanó', province: 'La Habana', municipality: 'Diez de Octubre', lat: 23.1089, lng: -82.3737, aliases: ['luyano'] },
  { name: 'Víbora', province: 'La Habana', municipality: 'Diez de Octubre', lat: 23.0983, lng: -82.3711, aliases: ['la vibora', 'vibora'] },
  { name: 'Lawton', province: 'La Habana', municipality: 'Diez de Octubre', lat: 23.0936, lng: -82.3633 },

  // Matanzas
  { name: 'Varadero', province: 'Matanzas', municipality: 'Cárdenas', lat: 23.1667, lng: -81.2500 },
  { name: 'Playa Girón', province: 'Matanzas', municipality: 'Ciénaga de Zapata', lat: 22.0667, lng: -81.0333, aliases: ['playa giron'] },
  { name: 'Playa Larga', province: 'Matanzas', municipality: 'Ciénaga de Zapata', lat: 22.2833, lng: -81.1667 },

  // Ciego de Ávila
  { name: 'Cayo Coco', province: 'Ciego de Ávila', municipality: 'Morón', lat: 22.5167, lng: -78.3833 },
  { name: 'Cayo Guillermo', province: 'Ciego de Ávila', municipality: 'Morón', lat: 22.5833, lng: -78.6333 },

  // Oriente
  { name: 'Guardalavaca', province: 'Holguín', municipality: 'Guardalavaca', lat: 21.1210, lng: -75.8340, aliases: ['playa guardalavaca'] },

  // Occidente
  { name: 'Soroa', province: 'Artemisa', municipality: 'Candelaria', lat: 22.8000, lng: -82.9833 },
  { name: 'Las Terrazas', province: 'Artemisa', municipality: 'Candelaria', lat: 22.8500, lng: -82.9333 },
];

/** Normaliza para comparar sin tildes, mayúsculas ni puntuación. */
function normalizeZoneName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type ZoneAliasEntry = {
  zone: CubaZone;
  alias: string;
};

const ZONE_ALIAS_INDEX: ZoneAliasEntry[] = CUBA_ZONES.flatMap((zone) =>
  [zone.name, ...(zone.aliases ?? [])].map((alias) => ({
    zone,
    alias: normalizeZoneName(alias),
  }))
).filter((entry) => entry.alias.length >= 4);

/**
 * Busca una zona conocida dentro de un texto libre.
 *
 * Gana la coincidencia más larga (para que "Nuevo Vedado" no se quede en
 * "Vedado") y, si hay contexto de provincia o municipio, se prioriza la zona
 * que coincide con él. Si no aparece ninguna zona conocida devuelve `undefined`
 * y el llamador puede intentar con el geocodificador.
 */
export function findCubaZone(
  text: string,
  context: CubaZoneContext = {}
): CubaZone | undefined {
  const normalized = normalizeZoneName(text);
  if (!normalized) return undefined;

  const padded = ` ${normalized} `;
  const province = normalizeZoneName(context.province ?? '');
  const municipality = normalizeZoneName(context.municipality ?? '');

  let best: { zone: CubaZone; score: number; index: number } | undefined;

  for (const entry of ZONE_ALIAS_INDEX) {
    const index = padded.indexOf(` ${entry.alias} `);
    if (index === -1) continue;

    let score = entry.alias.length;

    if (province) {
      score += normalizeZoneName(entry.zone.province) === province ? 30 : -10;
    }

    if (municipality) {
      score += normalizeZoneName(entry.zone.municipality) === municipality ? 30 : -15;
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score && index < best.index)
    ) {
      best = { zone: entry.zone, score, index };
    }
  }

  return best?.zone;
}

/**
 * Indica si el texto empieza por el nombre de una zona conocida.
 *
 * Sirve para no leer el municipio "Playa" dentro de "Playa Guardalavaca" o
 * "Playa del Este": ahí la primera palabra forma parte de un topónimo más largo.
 */
export function isKnownZonePhrase(value: string): boolean {
  const normalized = normalizeZoneName(value);
  if (!normalized) return false;

  return ZONE_ALIAS_INDEX.some(
    (entry) =>
      entry.alias === normalized || entry.alias.startsWith(`${normalized} `)
  );
}

/** Indica si una zona coincide con la provincia y el municipio indicados. */
export function zoneMatchesContext(zone: CubaZone, context: CubaZoneContext): boolean {
  const province = normalizeZoneName(context.province ?? '');
  const municipality = normalizeZoneName(context.municipality ?? '');

  if (province && normalizeZoneName(zone.province) !== province) return false;
  if (municipality && normalizeZoneName(zone.municipality) !== municipality) return false;

  return true;
}

/** Compara dos nombres de zona sin tildes ni mayúsculas. */
export function sameZoneName(a?: string, b?: string): boolean {
  return normalizeZoneName(a ?? '') === normalizeZoneName(b ?? '');
}
