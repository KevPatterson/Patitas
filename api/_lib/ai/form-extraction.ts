/**
 * Extracción de datos para el formulario de publicación a partir de OCR y visión.
 *
 * Este módulo es puro (no toca Supabase ni la red) para poder probarlo con
 * vitest. Devuelve las mismas claves y enums que usa el formulario
 * (`species: 'dog'`, `size: 'small'`, `ageApprox: 'puppy'`), no los del
 * proveedor (`DOG`, `SMALL`). Ese desajuste era el que dejaba los selects
 * vacíos aunque la IA hubiera detectado el dato.
 *
 * Regla de oro: no se inventa nada. Si un atributo no aparece en el texto ni en
 * las etiquetas de visión, se omite. Antes `size` se fijaba a `medium` por
 * defecto, lo que rellenaba el formulario con información falsa.
 *
 * La ubicación se resuelve contra los municipios reales de Cuba
 * (`cuba-locations.ts`). Si el aviso solo menciona el municipio, se devuelven
 * sus coordenadas; si menciona una calle, se devuelve también `address` para
 * que el cliente afine con el geocodificador.
 */

import {
  findCubaZone,
  isKnownZonePhrase,
  MUNICIPALITY_COORDINATES,
  PROVINCE_COORDINATES,
  zoneMatchesContext,
  type Coordinates,
} from '../../../src/lib/constants/cuba-locations.js';

export type FormSpecies = 'dog' | 'cat' | 'bird' | 'rabbit' | 'rodent' | 'reptile' | 'other';
export type FormSize = 'small' | 'medium' | 'large';
export type FormSex = 'male' | 'female';
export type FormAge = 'puppy' | 'young' | 'adult' | 'senior';
export type FormContactMode = 'INTERNAL' | 'PHONE' | 'WHATSAPP' | 'EMAIL';
export type FormPublicationType = 'LOST' | 'FOUND' | 'ABANDONED' | 'ADOPTION' | 'SIGHTING';
export type LocationPrecision = 'zone' | 'municipality' | 'province' | 'none';

export type FormExtraction = {
  // Datos del animal
  species?: FormSpecies;
  breed?: string;
  color?: string;
  size?: FormSize;
  sex?: FormSex;
  ageApprox?: FormAge;
  characteristics?: string;
  collar?: boolean;
  plate?: boolean;

  // Datos del aviso
  type?: FormPublicationType;
  title?: string;
  description?: string;
  petName?: string;

  // Ubicación
  province?: string;
  municipality?: string;
  zone?: string;
  /** Calle y número, si aparecen escritos. El cliente la geocodifica. */
  address?: string;
  latitude?: number;
  longitude?: number;
  locationPrecision?: LocationPrecision;

  // Fecha y contacto
  reward?: string;
  eventDate?: string;
  eventTimeApprox?: string;
  contactMode?: FormContactMode;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactEmail?: string;

  /** Texto reconocido en la imagen, para que el usuario pueda contrastarlo. */
  ocrText?: string;
  hasTextOverlay: boolean;
  /**
   * Indica si la visión detectó a la mascota dentro de la imagen.
   *
   * Es una señal aparte de `species`: un cartel puede nombrar al perro sin que
   * el animal aparezca en la foto. El cliente solo usa la imagen como foto de
   * la publicación cuando este valor es `true`.
   */
  hasPet?: boolean;
  /** 0..1. Media de las fuentes que aportaron datos. */
  confidence: number;
};

export type OcrInput = {
  text: string;
  confidence: number;
};

export type VisionInput = {
  labels: Array<{ label: string; confidence: number }>;
  description?: string;
};

/** Provincias canónicas: deben coincidir con las claves de `CUBA` en el frontend. */
const PROVINCES = [
  'Pinar del Río',
  'Artemisa',
  'La Habana',
  'Mayabeque',
  'Matanzas',
  'Villa Clara',
  'Cienfuegos',
  'Sancti Spíritus',
  'Ciego de Ávila',
  'Camagüey',
  'Las Tunas',
  'Holguín',
  'Granma',
  'Santiago de Cuba',
  'Guantánamo',
  'Isla de la Juventud',
];

/**
 * Nombres alternativos de provincias.
 *
 * `Habana` a secas es la forma habitual de nombrar la provincia y además
 * aparece dentro de `Centro Habana`, `Habana Vieja` y `Habana del Este`, que
 * también pertenecen a La Habana.
 */
const PROVINCE_ALIASES: Record<string, string[]> = {
  'La Habana': ['la habana', 'habana', 'ciudad de la habana'],
  'Las Tunas': ['las tunas', 'victoria de las tunas'],
  'Isla de la Juventud': ['isla de la juventud', 'isla de pinos'],
};

/**
 * Alias de municipios cuyo nombre oficial no coincide con el que usa la gente.
 * La clave es el texto normalizado y el valor el nombre canónico.
 */
const MUNICIPALITY_ALIASES: Record<string, string> = {
  'la habana vieja': 'Habana Vieja',
  'carlos manuel de cespedes': 'Céspedes',
};

/**
 * Municipios cuyo nombre es también una palabra común. Sin una pista clara
 * (provincia o marcador como "municipio"/"reparto") no se aceptan, para no
 * confundir "en la playa" con el municipio Playa.
 */
const AMBIGUOUS_MUNICIPALITIES = new Set([
  'playa',
  'regla',
  'minas',
  'colon',
  'florida',
  'esmeralda',
  'candelaria',
  'trinidad',
  'la palma',
  'san luis',
  'san nicolas',
  'media luna',
  'pilon',
  'yara',
  'cueto',
  'moa',
  'cespedes',
  'mella',
  'banes',
  'antilla',
  'bauta',
  'cruces',
  'lajas',
  'rodas',
  'palmira',
  'abreus',
  'cifuentes',
  'placetas',
  'remedios',
]);

const SPECIES_PATTERNS: Array<[FormSpecies, RegExp]> = [
  ['dog', /\b(perr[oa]s?|dog|dogs|canino|cachorr[oa]s?)\b/i],
  ['cat', /\b(gat[oa]s?|cat|cats|felino)\b/i],
  ['bird', /\b(ave|aves|p[aá]jaro|p[aá]jara|bird|loro|cotorra|periquito)\b/i],
  ['rabbit', /\b(conejo|coneja|conejos|rabbit|bunny)\b/i],
  ['rodent', /\b(roedor|roedores|h[aá]mster|hamster|cobaya|rat[oó]n|mouse)\b/i],
  ['reptile', /\b(reptil|reptiles|tortuga|iguana|serpiente|snake|lizard)\b/i],
];

/**
 * Etiquetas de visión que indican que hay un animal en la imagen.
 *
 * Se usan como respaldo cuando el modelo no devuelve `has_pet` de forma
 * explícita. No se busca en el texto OCR: un cartel que dice "perro perdido"
 * no significa que el perro esté en la foto.
 */
const PET_LABEL_PATTERN =
  /\b(perr[oa]s?|dogs?|cachorr[oa]s?|pupp(?:y|ies)|gat[oa]s?|cats?|kittens?|felino|ave|bird|p[aá]jaro|conejo|rabbit|roedor|hamster|cobaya|reptil|tortuga|iguana|serpiente|pet|mascota|animal)\b/i;

const SIZE_PATTERNS: Array<[FormSize, RegExp]> = [
  ['small', /\b(peque[nñ][oa]s?|small|mini|chiquit[oa]s?)\b/i],
  ['medium', /\b(median[oa]s?|medium)\b/i],
  ['large', /\b(grandes?|large|big)\b/i],
];

const SEX_PATTERNS: Array<[FormSex, RegExp]> = [
  ['male', /\b(macho|machito|male|var[oó]n)\b/i],
  ['female', /\b(hembra|hembrita|female|femenina)\b/i],
];

const AGE_PATTERNS: Array<[FormAge, RegExp]> = [
  ['puppy', /\b(cachorr[oa]s?|puppy|puppies)\b/i],
  ['young', /\b(joven|j[oó]venes|young)\b/i],
  ['adult', /\b(adult[oa]s?|adult)\b/i],
  ['senior', /\b(ancian[oa]s?|senior|viej[oa]s?)\b/i],
];

/** Colores frecuentes. Se devuelven con la etiqueta que espera el formulario. */
const COLOR_PATTERNS: Array<[string, RegExp]> = [
  ['Negro', /\b(negro|negra|negros|negras|black)\b/i],
  ['Blanco', /\b(blanco|blanca|blancos|blancas|white)\b/i],
  ['Marrón', /\b(marr[oó]n|marrones|brown|chocolate)\b/i],
  ['Dorado', /\b(dorado|dorada|golden|gold)\b/i],
  ['Gris', /\b(gris|grises|gray|grey)\b/i],
  ['Atigrado', /\b(atigrad[oa]|tigrado|tabby)\b/i],
  ['Naranja', /\b(naranja|anaranjado|orange|ginger)\b/i],
  ['Crema', /\b(crema|beige|cream)\b/i],
];

/** Orden de prioridad: un aviso perdido no debe clasificarse como adopción. */
const TYPE_PATTERNS: Array<[FormPublicationType, RegExp]> = [
  ['LOST', /\b(perdid[oa]s?|se perdio|se nos perdio|extraviad[oa]s?|se busca|busco a mi)\b/],
  ['FOUND', /\b(encontrad[oa]s?|encontre|hallad[oa]s?|rescatad[oa]s?|rescate)\b/],
  ['ABANDONED', /\b(abandonad[oa]s?|abandono)\b/],
  ['ADOPTION', /\b(en adopcion|adopcion|adoptar|busca hogar|busco hogar|dar en adopcion)\b/],
  ['SIGHTING', /\b(avistamiento|avistad[oa]s?|visto en)\b/],
];

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** Marcador de ubicación delante del nombre del municipio. */
const LOCATION_MARKER =
  /\b(?:en|desde|hacia|cerca de|frente a|frente al|detras de|junto a|municipio|reparto|barrio|zona|consejo popular|villa|pueblo|ciudad|localidad|comunidad|asentamiento|residencial|provincia|area)\s+(?:de\s+|del\s+|la\s+|el\s+|los\s+|las\s+)?$/;

/** Marcador explícito: sirve incluso para nombres ambiguos. */
const EXPLICIT_MARKER =
  /\b(?:municipio|reparto|barrio|zona|consejo popular|villa|pueblo|ciudad|localidad|comunidad|asentamiento|residencial)\s+(?:de\s+|del\s+)?$/;

type MunicipalityEntry = {
  province: string;
  name: string;
  normalized: string;
  coordinates: Coordinates;
};

/** Quita tildes para comparar provincias aunque el OCR las pierda. */
function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value: string): string {
  return stripDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function firstMatch<T>(patterns: Array<[T, RegExp]>, text: string): T | undefined {
  for (const [value, pattern] of patterns) {
    if (pattern.test(text)) return value;
  }
  return undefined;
}

function findColors(text: string): string | undefined {
  const matches: Array<{ color: string; index: number }> = [];

  for (const [color, pattern] of COLOR_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.index !== undefined) matches.push({ color, index: match.index });
  }

  // Se ordenan por aparición para que "marrón y blanco" no acabe al revés.
  matches.sort((a, b) => a.index - b.index);

  const found: string[] = [];
  for (const match of matches) {
    if (!found.includes(match.color)) found.push(match.color);
    if (found.length === 3) break;
  }

  return found.length > 0 ? found.join(' y ') : undefined;
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

// ---------------------------------------------------------------------------
// Índice de municipios
// ---------------------------------------------------------------------------

const MUNICIPALITY_INDEX: MunicipalityEntry[] = Object.entries(MUNICIPALITY_COORDINATES).map(
  ([key, coordinates]) => {
    const separator = key.indexOf('|');
    const province = key.slice(0, separator);
    const name = key.slice(separator + 1);

    return { province, name, normalized: normalizeText(name), coordinates };
  }
);

/**
 * Agrupa por nombre normalizado porque hay municipios homónimos en provincias
 * distintas (por ejemplo, San Luis en Pinar del Río y en Santiago de Cuba).
 */
const MUNICIPALITY_BY_NAME = new Map<string, MunicipalityEntry[]>();

for (const entry of MUNICIPALITY_INDEX) {
  const existing = MUNICIPALITY_BY_NAME.get(entry.normalized) ?? [];
  existing.push(entry);
  MUNICIPALITY_BY_NAME.set(entry.normalized, existing);
}

for (const [alias, canonical] of Object.entries(MUNICIPALITY_ALIASES)) {
  const entries = MUNICIPALITY_INDEX.filter(
    (entry) => entry.normalized === normalizeText(canonical)
  );

  if (entries.length > 0) MUNICIPALITY_BY_NAME.set(alias, entries);
}

/** Devuelve la provincia canónica si el texto la menciona. */
export function findProvince(text: string): string | undefined {
  const normalized = normalizeText(text);
  let best: { province: string; index: number } | undefined;

  for (const province of PROVINCES) {
    const names = [province, ...(PROVINCE_ALIASES[province] ?? [])].map(normalizeText);

    for (const name of names) {
      const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(name)}(?=$|[^a-z0-9])`);
      const match = pattern.exec(normalized);

      if (match && (!best || match.index < best.index)) {
        best = { province, index: match.index };
      }
    }
  }

  return best?.province;
}

/** Normaliza el valor de un campo `province` del JSON de visión. */
function normalizeProvince(value?: string): string | undefined {
  if (!value) return undefined;

  const normalized = normalizeText(value);

  for (const province of PROVINCES) {
    const names = [province, ...(PROVINCE_ALIASES[province] ?? [])].map(normalizeText);
    if (names.includes(normalized)) return province;
  }

  return findProvince(value);
}

/** Coincidencia exacta del nombre de un municipio (para campos explícitos). */
function matchMunicipalityExact(
  value: string,
  provinceHint?: string
): { province: string; municipality: string } | undefined {
  const target = normalizeText(value);
  const entries = MUNICIPALITY_BY_NAME.get(target) ?? [];

  if (entries.length === 0) return undefined;

  const inProvince = provinceHint
    ? entries.find((entry) => entry.province === provinceHint)
    : undefined;

  if (inProvince) {
    return { province: inProvince.province, municipality: inProvince.name };
  }

  if (entries.length === 1) {
    return { province: entries[0].province, municipality: entries[0].name };
  }

  return undefined;
}

/**
 * Busca un municipio en texto libre y devuelve su provincia canónica.
 *
 * Se puntúa cada aparición para no aceptar nombres comunes sin contexto. Un
 * municipio repetido en varias provincias solo se resuelve si el texto menciona
 * la provincia; si no, se omite en vez de adivinar.
 */
export function findMunicipality(
  text: string,
  provinceHint?: string
): { province: string; municipality: string } | undefined {
  const normalized = normalizeText(text);
  if (!normalized) return undefined;

  const detectedProvince = provinceHint ?? findProvince(text);
  const candidates: Array<{
    entry: MunicipalityEntry;
    score: number;
    length: number;
    index: number;
  }> = [];

  for (const [key, entries] of MUNICIPALITY_BY_NAME) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])(${escapeRegExp(key)})(?=$|[^a-z0-9])`, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(normalized)) !== null) {
      // `match.index` apunta al separador que precede al nombre (el grupo es
      // `(?:^|[^a-z0-9])`); el marcador se busca justo antes del nombre.
      const index = match.index + match[0].lastIndexOf(match[1]);
      const before = normalized.slice(Math.max(0, index - 45), index);
      const hasMarker = LOCATION_MARKER.test(before);
      const explicitMarker = EXPLICIT_MARKER.test(before);
      const hasArticle = /\b(?:el|la|los|las)\s+$/.test(before);
      const provinceMatch = detectedProvince
        ? entries.find((entry) => entry.province === detectedProvince)
        : undefined;
      const unique = entries.length === 1;
      const ambiguous = AMBIGUOUS_MUNICIPALITIES.has(key);
      const multiword = key.includes(' ');

      // "Playa Guardalavaca" o "Playa del Este" no son el municipio Playa: la
      // primera palabra forma parte de un topónimo más largo. Sin esta guarda,
      // el marcador caía en La Habana en lugar de en Holguín.
      const after = normalized.slice(index + key.length).trimStart();
      const firstWords = after.split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
      if (ambiguous && firstWords && isKnownZonePhrase(`${key} ${firstWords}`)) continue;

      // Un homónimo sin provincia es irresoluble: mejor omitirlo.
      if (!provinceMatch && !unique) continue;

      let score = 1;
      if (multiword) score += 1;
      if (provinceMatch) score += 3;
      if (hasMarker) score += 1;

      // "en la playa" o "Playa" a secas no identifican el municipio; "en Playa"
      // o "municipio Playa" sí.
      if (ambiguous && !provinceMatch && !explicitMarker && (!hasMarker || hasArticle)) {
        score -= 3;
      }

      const acceptable =
        Boolean(provinceMatch) ||
        explicitMarker ||
        (hasMarker && !(ambiguous && hasArticle)) ||
        (multiword && key.length >= 8 && !ambiguous) ||
        (!multiword && key.length >= 6 && !ambiguous);

      if (acceptable && score > 0) {
        candidates.push({
          entry: provinceMatch ?? entries[0],
          score,
          length: key.length,
          index,
        });
      }
    }
  }

  // Ante empate gana la mención más temprana: en "San Luis, Pinar del Río" el
  // municipio buscado es San Luis, no la capital provincial.
  candidates.sort((a, b) => b.score - a.score || a.index - b.index || b.length - a.length);

  const best = candidates[0];
  return best ? { province: best.entry.province, municipality: best.entry.name } : undefined;
}

// ---------------------------------------------------------------------------
// Tipo de aviso
// ---------------------------------------------------------------------------

export function findType(text: string): FormPublicationType | undefined {
  const normalized = normalizeText(text);

  for (const [type, pattern] of TYPE_PATTERNS) {
    if (pattern.test(normalized)) return type;
  }

  return undefined;
}

function normalizeType(value?: string): FormPublicationType | undefined {
  if (!value) return undefined;

  const normalized = normalizeText(value);

  if (/^(lost|perdid[oa]|extraviad[oa])$/.test(normalized)) return 'LOST';
  if (/^(found|encontrad[oa]|hallad[oa])$/.test(normalized)) return 'FOUND';
  if (/^(adoption|adopcion|en adopcion)$/.test(normalized)) return 'ADOPTION';
  if (/^(abandoned|abandonad[oa])$/.test(normalized)) return 'ABANDONED';
  if (/^(sighting|avistamiento|avistad[oa])$/.test(normalized)) return 'SIGHTING';

  return findType(value);
}

// ---------------------------------------------------------------------------
// Fechas y horas
// ---------------------------------------------------------------------------

function buildDate(year: number, month: number, day: number): string | undefined {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return undefined;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Normaliza una fecha a `YYYY-MM-DD`, que es lo que acepta `<input type="date">`.
 *
 * El formato cubano es día/mes/año. También se entienden fechas escritas
 * ("12 de mayo de 2024") y relativas ("ayer", "hace 2 días").
 */
export function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;

  const text = normalizeText(value);
  const today = new Date();

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (numeric) {
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    return buildDate(year, Number(numeric[2]), Number(numeric[1]));
  }

  const written = text.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (written) {
    const month = MONTHS[written[2]];
    if (month) {
      return buildDate(Number(written[3] ?? today.getFullYear()), month, Number(written[1]));
    }
  }

  if (/\bayer\b/.test(text)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return formatLocalDate(date);
  }

  if (/\bhoy\b/.test(text)) return formatLocalDate(today);

  const relative = text.match(/\bhace\s+(\d+)\s+(dias?|semanas?)\b/);
  if (relative) {
    const amount = Number(relative[1]);
    const date = new Date(today);
    date.setDate(date.getDate() - (relative[2].startsWith('semana') ? amount * 7 : amount));
    return formatLocalDate(date);
  }

  return undefined;
}

/**
 * Normaliza una hora a `HH:MM` de 24 horas, que es lo que acepta
 * `<input type="time">`.
 */
export function normalizeTime(value?: string): string | undefined {
  if (!value) return undefined;

  const text = normalizeText(value);

  const clock = text.match(/\b(\d{1,2}):(\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/);
  if (clock) {
    let hour = Number(clock[1]);
    const minute = Number(clock[2]);
    const meridiem = clock[3]?.replace(/[.\s]/g, '');

    if (minute > 59) return undefined;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour > 23) return undefined;

    return `${pad(hour)}:${pad(minute)}`;
  }

  const meridiemOnly = text.match(/\b(\d{1,2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)\b/);
  if (meridiemOnly) {
    let hour = Number(meridiemOnly[1]);
    const meridiem = meridiemOnly[2].replace(/[.\s]/g, '');

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour > 23) return undefined;

    return `${pad(hour)}:00`;
  }

  const spanish = text.match(/\ba las?\s+(\d{1,2})\s+de\s+la\s+(manana|tarde|noche)\b/);
  if (spanish) {
    let hour = Number(spanish[1]);

    if ((spanish[2] === 'tarde' || spanish[2] === 'noche') && hour < 12) hour += 12;
    if (hour > 23) return undefined;

    return `${pad(hour)}:00`;
  }

  return undefined;
}

function findDate(text: string): string | undefined {
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/,
    /\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s+(?:de\s+\d{4})?/i,
    /\bhace\s+\d+\s+(?:d[ií]as?|semanas?)\b/i,
    /\b(?:hoy|ayer)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const normalized = normalizeDate(match[0]);
    if (normalized) return normalized;
  }

  return undefined;
}

function findTime(text: string): string | undefined {
  const patterns = [
    /\b\d{1,2}:\d{2}\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?/i,
    /\b\d{1,2}\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)\b/i,
    /\ba las?\s+\d{1,2}\s+de\s+la\s+(?:mañana|tarde|noche)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const normalized = normalizeTime(match[0]);
    if (normalized) return normalized;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Zona y dirección
// ---------------------------------------------------------------------------

/** Recorta el texto en cuanto empieza un dato de contacto o un teléfono. */
function cleanReference(value: string): string | undefined {
  const withoutContact = value
    .split(
      /\b(?:tel[eé]fono|tel\.?|llama(?:r)?|whatsapp|wasap|contacto|celular|m[oó]vil|correo|email)\b/i
    )[0]
    .replace(/(?:\+?53[\s-]?)?5\d{7}.*$/, '')
    .replace(/[|•;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:-]+|[\s,.:-]+$/g, '')
    .trim();

  return withoutContact.length >= 2 ? withoutContact : undefined;
}

/** Busca un reparto, barrio o referencia ("cerca del malecón"). */
export function findZone(text: string): string | undefined {
  // Primero se buscan zonas conocidas: "Vedado" o "cerca del malecón" no llevan
  // la palabra "reparto" y antes se perdían, dejando el marcador en el centro
  // del municipio.
  const known = findCubaZone(text);
  if (known) return known.name;

  const keyword = text.match(
    /\b(?:reparto|barrio|consejo popular|zona|urbanizaci[oó]n|comunidad|asentamiento|residencial)\s+([^\n\r,;.|•]{2,60})/i
  );

  if (keyword?.[1]) {
    const zone = cleanReference(keyword[1]);
    if (zone) return zone;
  }

  const reference = text.match(/\bcerca\s+(?:de|del|de la)\s+([^\n\r,;.|]{2,50})/i);

  if (reference?.[1]) {
    const zone = cleanReference(reference[1]);

    // "Cerca de La Habana" no aporta nada si ya está la provincia.
    if (zone && !findProvince(zone) && !findMunicipality(zone)) {
      return `Cerca de ${zone}`;
    }
  }

  return undefined;
}

/**
 * Partes que pueden seguir a un punto dentro de una dirección.
 *
 * "Calle 23 No. 456. Apto 2" es una sola dirección: cortar en el punto dejaría
 * "Calle 23 No" y el geocodificador no encontraría nada.
 */
const ADDRESS_CONTINUATION =
  /^(?:apto|apartamento|edificio|edif|rpto|reparto|entre|esquina|interior|altos|bajos|casa|solar|km)\b/i;

/**
 * Recorta la dirección cuando empieza otra frase.
 *
 * Los puntos de las abreviaturas ("No. 456") y los de una parte secundaria de la
 * dirección no cierran la captura; un punto seguido de una frase con mayúscula
 * sí ("Calle 23 #456. Perro perdido ...").
 */
function trimAddressSentence(value: string): string {
  const parts = value.split(/\.\s+/);
  let result = parts[0] ?? '';

  for (const part of parts.slice(1)) {
    const startsSentence = /^[A-ZÁÉÍÓÚÑ]/.test(part);
    if (startsSentence && !ADDRESS_CONTINUATION.test(part)) break;

    result += `. ${part}`;
  }

  return result;
}

/**
 * Busca una dirección con calle y número.
 *
 * `cleanReference` recorta teléfonos y datos de contacto; `trimAddressSentence`
 * evita que la captura se trague la frase siguiente.
 */
export function findAddress(text: string): string | undefined {
  const match = text.match(
    /\b((?:calle|avenida|ave\.?|carretera|calzada|callej[oó]n|pasaje|autopista|v[ií]a|ruta|km)\s+[^\n\r|•;]{2,100})/i
  );

  if (!match?.[1]) return undefined;

  const address = cleanReference(trimAddressSentence(match[1]));
  return address && address.length >= 4 ? address : undefined;
}

// ---------------------------------------------------------------------------
// Visión
// ---------------------------------------------------------------------------

/**
 * Extrae el JSON de la respuesta de visión. El modelo puede envolverlo en
 * markdown o añadir texto alrededor, así que se prueban las dos formas.
 */
export function parseVisionJson(description?: string): Record<string, unknown> | null {
  if (!description) return null;

  const cleaned = description
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/g, '')
    .trim();

  const candidates = [cleaned];
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // No es JSON: se prueba el siguiente candidato.
    }
  }

  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (
        trimmed &&
        !/^(null|undefined|none|unknown|n\/a|no visible|no detectado|desconocid[oa])$/i.test(
          trimmed
        )
      ) {
        return trimmed;
      }
    }

    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function pickBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'boolean') return value;

    if (typeof value === 'string') {
      const normalized = normalizeText(value);

      if (['si', 'true', 'yes', 'tiene'].includes(normalized)) return true;
      if (['no', 'false', 'ninguno', 'ninguna'].includes(normalized)) return false;
    }
  }

  return undefined;
}

function cleanText(value: string, max: number): string | undefined {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;

  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trimEnd()}...` : cleaned;
}

/**
 * Normaliza un teléfono cubano a `+53XXXXXXXX`.
 *
 * La visión suele devolver `55512345` o `+53 55512345`; el formulario y la
 * función de revelar contacto esperan el prefijo internacional. Los números que
 * no son móviles cubanos se dejan tal cual para no corromperlos.
 */
function normalizePhone(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = trimmed.replace(/[^\d+]/g, '').match(/^(?:\+?53)?(5\d{7})$/);
  return match ? `+53${match[1]}` : trimmed;
}

function titleCase(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function normalizeSpecies(value?: string): FormSpecies | undefined {
  if (!value) return undefined;

  const normalized = normalizeText(value);

  if (/\b(perr|dog|canin)/.test(normalized)) return 'dog';
  if (/\b(gat|cat|felin)/.test(normalized)) return 'cat';
  if (/\b(ave|pajaro|bird|loro|cotorra)/.test(normalized)) return 'bird';
  if (/\b(conejo|rabbit|bunny)/.test(normalized)) return 'rabbit';
  if (/\b(roedor|hamster|cobaya|raton|mouse)/.test(normalized)) return 'rodent';
  if (/\b(reptil|tortuga|iguana|serpiente|snake)/.test(normalized)) return 'reptile';
  if (/\b(otro|other|mascota)/.test(normalized)) return 'other';

  return undefined;
}

function normalizeSize(value?: string): FormSize | undefined {
  if (!value) return undefined;

  const normalized = normalizeText(value);

  if (/\b(pequen|small|mini|chiquit)/.test(normalized)) return 'small';
  if (/\b(median|medium)/.test(normalized)) return 'medium';
  if (/\b(grande|large|big)/.test(normalized)) return 'large';

  return undefined;
}

function normalizeSex(value?: string): FormSex | undefined {
  if (!value) return undefined;

  const normalized = normalizeText(value);

  if (/\b(macho|male|varon)/.test(normalized)) return 'male';
  if (/\b(hembra|female|femenina)/.test(normalized)) return 'female';

  return undefined;
}

function normalizeAge(value?: string): FormAge | undefined {
  if (!value) return undefined;

  const normalized = normalizeText(value);

  if (/\b(cachorr|puppy)/.test(normalized)) return 'puppy';
  if (/\b(joven|young)/.test(normalized)) return 'young';
  if (/\b(adult)/.test(normalized)) return 'adult';
  if (/\b(ancian|senior|viej)/.test(normalized)) return 'senior';

  return undefined;
}

/**
 * Traduce el JSON de visión a los campos del formulario.
 *
 * Se aceptan claves en inglés y en español porque el modelo alterna entre las
 * dos según el prompt.
 */
function extractFromVisionJson(parsed: Record<string, unknown>): Partial<FormExtraction> {
  const result: Partial<FormExtraction> = {};

  const type = normalizeType(pickString(parsed, ['type', 'tipo', 'case_type']));
  if (type) result.type = type;

  const species = normalizeSpecies(pickString(parsed, ['species', 'especie']));
  if (species) result.species = species;

  // Señal explícita del modelo: ¿se ve la mascota en la imagen? Se respeta tal
  // cual, incluso un `false`, porque un cartel puede nombrar al animal sin
  // mostrarlo.
  const hasPet = pickBoolean(parsed, [
    'has_pet',
    'hasPet',
    'pet_visible',
    'petVisible',
    'mascota_visible',
  ]);
  if (hasPet !== undefined) result.hasPet = hasPet;

  const size = normalizeSize(pickString(parsed, ['size', 'tamano', 'tamaño']));
  if (size) result.size = size;

  const sex = normalizeSex(pickString(parsed, ['sex', 'sexo', 'gender']));
  if (sex) result.sex = sex;

  const age = normalizeAge(
    pickString(parsed, ['age', 'edad', 'age_approx', 'ageApprox', 'ageApproximate'])
  );
  if (age) result.ageApprox = age;

  const breed = pickString(parsed, ['breed', 'raza']);
  if (breed) result.breed = cleanText(breed, 60);

  const color = pickString(parsed, ['color', 'colour']);
  if (color) result.color = cleanText(color, 60);

  const characteristics = pickString(parsed, [
    'characteristics',
    'caracteristicas',
    'características',
    'features',
  ]);
  if (characteristics) result.characteristics = cleanText(characteristics, 300);

  const collar = pickBoolean(parsed, ['collar', 'tiene_collar']);
  if (collar !== undefined) result.collar = collar;

  const plate = pickBoolean(parsed, ['plate', 'placa', 'tiene_placa']);
  if (plate !== undefined) result.plate = plate;

  const province = normalizeProvince(pickString(parsed, ['province', 'provincia']));
  if (province) result.province = province;

  const municipalityValue = pickString(parsed, ['municipality', 'municipio']);
  if (municipalityValue) {
    const municipality =
      matchMunicipalityExact(municipalityValue, province) ??
      findMunicipality(municipalityValue, province);

    if (municipality) {
      result.province = municipality.province;
      result.municipality = municipality.municipality;
    }
  }

  const zone = pickString(parsed, ['zone', 'zona', 'barrio', 'reparto']);
  if (zone) result.zone = cleanReference(zone) ?? cleanText(zone, 80);

  const address = pickString(parsed, ['address', 'direccion', 'dirección']);
  if (address) result.address = cleanReference(address) ?? cleanText(address, 120);

  const eventDate = normalizeDate(
    pickString(parsed, ['event_date', 'eventDate', 'fecha', 'date'])
  );
  if (eventDate) result.eventDate = eventDate;

  const eventTime = normalizeTime(
    pickString(parsed, ['event_time', 'eventTime', 'eventTimeApprox', 'hora', 'time'])
  );
  if (eventTime) result.eventTimeApprox = eventTime;

  const reward = pickString(parsed, ['reward', 'recompensa']);
  if (reward) result.reward = cleanText(reward, 40);

  const phone = pickString(parsed, ['contact_phone', 'contactPhone', 'telefono', 'teléfono']);
  if (phone) result.contactPhone = normalizePhone(phone);

  const whatsapp = pickString(parsed, ['contact_whatsapp', 'contactWhatsapp', 'whatsapp']);
  if (whatsapp) result.contactWhatsapp = normalizePhone(whatsapp);

  const email = pickString(parsed, ['contact_email', 'contactEmail', 'email', 'correo']);
  if (email) result.contactEmail = email;

  const petName = pickString(parsed, ['pet_name', 'petName', 'nombre', 'name']);
  if (petName) result.petName = titleCase(petName);

  const title = pickString(parsed, ['title', 'titulo', 'título']);
  if (title) result.title = cleanText(title, 90);

  const description = pickString(parsed, ['description', 'descripcion', 'descripción']);
  if (description) result.description = cleanText(description, 1200);

  return result;
}

/**
 * Extrae datos estructurados del texto reconocido por OCR.
 *
 * Solo devuelve lo que aparece literalmente en el texto. El teléfono se
 * normaliza a `+53XXXXXXXX`, la fecha a `YYYY-MM-DD`, la hora a `HH:MM` y la
 * provincia/municipio a sus nombres canónicos (antes `Pinar del Río` salía como
 * `Pinar Del Río` y no coincidía con el `<option>` del formulario).
 */
export function extractStructuredDataFromText(text: string): Partial<FormExtraction> {
  const result: Partial<FormExtraction> = {};
  if (!text.trim()) return result;

  const normalized = normalizeText(text);

  const type = findType(text);
  if (type) result.type = type;

  const species = firstMatch(SPECIES_PATTERNS, normalized);
  if (species) result.species = species;

  const size = firstMatch(SIZE_PATTERNS, normalized);
  if (size) result.size = size;

  const sex = firstMatch(SEX_PATTERNS, normalized);
  if (sex) result.sex = sex;

  const age = firstMatch(AGE_PATTERNS, normalized);
  if (age) result.ageApprox = age;

  const color = findColors(normalized);
  if (color) result.color = color;

  // Móvil cubano: 8 dígitos que empiezan por 5, con o sin prefijo +53.
  const phoneMatch = text.match(/(?<!\d)(?:\+?53[\s-]?)?(5\d{7})(?!\d)/);
  if (phoneMatch?.[1]) {
    const phone = `+53${phoneMatch[1]}`;
    result.contactPhone = phone;
    result.contactWhatsapp = phone;
  }

  const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (emailMatch) result.contactEmail = emailMatch[0];

  const rewardMatch = text.match(/(?:recompensa|reward)[\s:]*(?:\$|CUP|USD)?\s*(\d+)/i);
  if (rewardMatch?.[1]) result.reward = `$${rewardMatch[1]}`;

  const eventDate = findDate(text);
  if (eventDate) result.eventDate = eventDate;

  const eventTime = findTime(text);
  if (eventTime) result.eventTimeApprox = eventTime;

  const province = findProvince(text);
  if (province) result.province = province;

  const municipality = findMunicipality(text, province);
  if (municipality) {
    result.province = municipality.province;
    result.municipality = municipality.municipality;
  }

  const zone = findZone(text);
  if (zone) {
    result.zone = zone;

    // Una zona conocida también identifica su municipio y provincia. Así un
    // aviso que solo dice "Vedado" o "Varadero" no se queda sin coordenadas.
    const zoneInfo = findCubaZone(zone, {
      province: result.province,
      municipality: result.municipality,
    });

    if (zoneInfo) {
      if (!result.province) result.province = zoneInfo.province;
      if (!result.municipality) result.municipality = zoneInfo.municipality;
    }
  }

  const address = findAddress(text);
  if (address) result.address = address;

  // Nombre de la mascota: solo si el texto lo declara explícitamente.
  const nameMatch = text.match(
    /(?:se llama|nombre|responde a)\s*:?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]{2,20})/i
  );
  if (nameMatch?.[1] && !/^(del|de|la|el|los|las|mi|su|un|una)$/i.test(nameMatch[1])) {
    result.petName = titleCase(nameMatch[1]);
  }

  return result;
}

/**
 * Traduce las etiquetas y la descripción de visión a atributos del formulario.
 *
 * Si la descripción trae JSON (lo habitual con el modelo de Cloudflare), se
 * usan sus valores. Los booleanos NO se deducen del texto cuando hay JSON:
 * antes la clave `"collar": false` hacía que `\bcollar\b` marcara `true`.
 */
export function extractAttributesFromVision(vision: VisionInput): Partial<FormExtraction> {
  const parsed = parseVisionJson(vision.description ?? '');
  const fromJson = parsed ? extractFromVisionJson(parsed) : {};
  const result: Partial<FormExtraction> = { ...fromJson };

  const labels = vision.labels.map((item) => item.label);
  const haystack = `${labels.join(' ')} ${vision.description ?? ''}`;
  const normalizedHaystack = normalizeText(haystack);

  if (!result.species) {
    const species = firstMatch(SPECIES_PATTERNS, normalizedHaystack);
    if (species) result.species = species;
  }

  // Respaldo cuando el modelo no devolvió `has_pet`: las etiquetas de visión o
  // una especie detectada por visión implican que el animal está en la imagen.
  if (result.hasPet === undefined) {
    const petInLabels = vision.labels.some((item) => PET_LABEL_PATTERN.test(item.label));
    if (petInLabels || result.species) result.hasPet = true;
  }

  if (!result.size) {
    const size = firstMatch(SIZE_PATTERNS, normalizedHaystack);
    if (size) result.size = size;
  }

  if (!result.sex) {
    const sex = firstMatch(SEX_PATTERNS, normalizedHaystack);
    if (sex) result.sex = sex;
  }

  if (!result.ageApprox) {
    const age = firstMatch(AGE_PATTERNS, normalizedHaystack);
    if (age) result.ageApprox = age;
  }

  if (!result.color) {
    const color = findColors(normalizedHaystack);
    if (color) result.color = color;
  }

  if (!parsed) {
    if (result.collar === undefined && /\bcollar\b/.test(normalizedHaystack)) {
      result.collar = true;
    }

    if (result.plate === undefined && /\b(tag|placa|plate|medalla|chapita)\b/.test(normalizedHaystack)) {
      result.plate = true;
    }
  }

  if (!result.characteristics) {
    const features: string[] = [];
    if (/\bcollar\b/.test(normalizedHaystack)) features.push('usa collar');
    if (/\b(outdoor|grass|park|street)\b/.test(normalizedHaystack)) {
      features.push('fotografiado al aire libre');
    }
    if (/\b(friendly|happy)\b/.test(normalizedHaystack)) features.push('aspecto amigable');
    if (features.length > 0) result.characteristics = features.join(', ');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Composición del aviso
// ---------------------------------------------------------------------------

const TYPE_ADJECTIVES: Record<FormPublicationType, { male: string; female: string }> = {
  LOST: { male: 'perdido', female: 'perdida' },
  FOUND: { male: 'encontrado', female: 'encontrada' },
  ABANDONED: { male: 'abandonado', female: 'abandonada' },
  ADOPTION: { male: 'en adopción', female: 'en adopción' },
  SIGHTING: { male: 'avistado', female: 'avistada' },
};

function speciesNoun(species?: FormSpecies, sex?: FormSex): string | undefined {
  switch (species) {
    case 'dog':
      return sex === 'female' ? 'Perra' : 'Perro';
    case 'cat':
      return sex === 'female' ? 'Gata' : 'Gato';
    case 'bird':
      return 'Ave';
    case 'rabbit':
      return sex === 'female' ? 'Coneja' : 'Conejo';
    case 'rodent':
      return 'Roedor';
    case 'reptile':
      return 'Reptil';
    case 'other':
      return 'Mascota';
    default:
      return undefined;
  }
}

/**
 * Compone un título solo con datos extraídos. Si no hay tipo de aviso ni
 * nombre, devuelve `undefined`: no se inventa un titular.
 */
function composeTitle(input: Partial<FormExtraction>): string | undefined {
  const noun = speciesNoun(input.species, input.sex);
  const adjective = input.type
    ? TYPE_ADJECTIVES[input.type][input.sex === 'female' ? 'female' : 'male']
    : undefined;

  if (!adjective && !input.petName) return undefined;

  const subject = noun ?? 'Mascota';
  const phrase = adjective ? `${subject} ${adjective}` : subject;
  const location = input.municipality ?? input.province;
  const title = location ? `${phrase} en ${location}` : phrase;

  const withName = input.petName
    ? `${input.petName}: ${title.charAt(0).toLowerCase()}${title.slice(1)}`
    : title;

  return `${withName.charAt(0).toUpperCase()}${withName.slice(1)}`;
}

/**
 * Prefiere la descripción que escribió el anunciante (visión u OCR). Solo si no
 * hay una, compone un texto con los campos extraídos.
 */
function composeDescription(
  input: Partial<FormExtraction>,
  ocrText: string
): string | undefined {
  if (input.description && input.description.trim().length >= 20) return input.description;

  const title = composeTitle(input);
  const cleanedOcr = ocrText.replace(/\s+/g, ' ').trim();

  if (
    cleanedOcr.length >= 20 &&
    normalizeText(cleanedOcr) !== normalizeText(title ?? '')
  ) {
    return cleanedOcr.slice(0, 1200);
  }

  const parts: string[] = [];
  if (title) parts.push(`${title}.`);
  if (input.color) parts.push(`Color ${input.color}.`);
  if (input.characteristics) {
    parts.push(
      `${input.characteristics.charAt(0).toUpperCase()}${input.characteristics.slice(1)}.`
    );
  }

  const contact = input.contactPhone ?? input.contactWhatsapp ?? input.contactEmail;
  if (contact) parts.push(`Contacto: ${contact}.`);

  const description = parts.join(' ').trim();
  return description.length >= 20 ? description : undefined;
}

// ---------------------------------------------------------------------------
// Coordenadas
// ---------------------------------------------------------------------------

/**
 * Resuelve las coordenadas del municipio o, si no hay, de la provincia.
 *
 * La precisión se devuelve junto a las coordenadas para que el mapa se centre
 * con el zoom adecuado: no es lo mismo un municipio que una provincia.
 */
export function resolveCoordinates(input: {
  province?: string;
  municipality?: string;
  zone?: string;
}): { latitude?: number; longitude?: number; locationPrecision: LocationPrecision } {
  let province = input.province;
  let municipality = input.municipality;

  if (!province && municipality) {
    const match = matchMunicipalityExact(municipality);
    if (match) {
      province = match.province;
      municipality = match.municipality;
    }
  }

  // La zona es más específica que el municipio, pero solo se acepta si no
  // contradice la provincia ni el municipio ya resueltos.
  const zone = input.zone
    ? findCubaZone(input.zone, { province, municipality })
    : undefined;

  if (
    zone &&
    zoneMatchesContext(zone, { province, municipality }) &&
    (!municipality || normalizeText(zone.name) !== normalizeText(municipality))
  ) {
    return {
      latitude: zone.lat,
      longitude: zone.lng,
      locationPrecision: 'zone',
    };
  }

  if (province && municipality) {
    const coordinates = MUNICIPALITY_COORDINATES[`${province}|${municipality}`];

    if (coordinates) {
      return {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        locationPrecision: 'municipality',
      };
    }
  }

  if (province) {
    const coordinates = PROVINCE_COORDINATES[province];

    if (coordinates) {
      return {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        locationPrecision: 'province',
      };
    }
  }

  return { locationPrecision: 'none' };
}

// ---------------------------------------------------------------------------
// Composición final
// ---------------------------------------------------------------------------

/**
 * Combina OCR y visión en el objeto que consume el formulario.
 *
 * Prioridad: visión para lo físico (especie, color, tamaño), OCR para lo que
 * solo puede estar escrito (teléfono, email, provincia, fecha, recompensa).
 */
export function buildFormExtraction(input: {
  ocr?: OcrInput | null;
  vision?: VisionInput | null;
}): FormExtraction {
  const ocrText = input.ocr?.text?.trim() ?? '';
  const fromOcr = ocrText ? extractStructuredDataFromText(ocrText) : {};
  const fromVision = input.vision ? extractAttributesFromVision(input.vision) : {};

  const result: FormExtraction = {
    hasTextOverlay: ocrText.length > 0,
    confidence: 0,
  };

  const assign = <K extends keyof FormExtraction>(
    key: K,
    value: FormExtraction[K] | undefined
  ) => {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  };

  assign('type', fromOcr.type ?? fromVision.type);
  assign('species', fromVision.species ?? fromOcr.species);
  assign('hasPet', fromVision.hasPet);
  assign('breed', fromVision.breed ?? fromOcr.breed);
  assign('color', fromVision.color ?? fromOcr.color);
  assign('size', fromVision.size ?? fromOcr.size);
  assign('sex', fromVision.sex ?? fromOcr.sex);
  assign('ageApprox', fromVision.ageApprox ?? fromOcr.ageApprox);
  assign('characteristics', fromVision.characteristics ?? fromOcr.characteristics);
  assign('collar', fromVision.collar ?? fromOcr.collar);
  assign('plate', fromVision.plate ?? fromOcr.plate);

  assign('province', fromOcr.province ?? fromVision.province);
  assign('municipality', fromOcr.municipality ?? fromVision.municipality);
  assign('zone', fromOcr.zone ?? fromVision.zone);
  assign('address', fromOcr.address ?? fromVision.address);
  assign('reward', fromOcr.reward ?? fromVision.reward);
  assign('eventDate', fromOcr.eventDate ?? fromVision.eventDate);
  assign('eventTimeApprox', fromOcr.eventTimeApprox ?? fromVision.eventTimeApprox);
  assign('petName', fromOcr.petName ?? fromVision.petName);
  assign('title', fromVision.title ?? fromOcr.title);
  assign('description', fromVision.description ?? fromOcr.description);

  assign('contactPhone', fromOcr.contactPhone ?? fromVision.contactPhone);
  assign('contactWhatsapp', fromOcr.contactWhatsapp ?? fromVision.contactWhatsapp);
  assign('contactEmail', fromOcr.contactEmail ?? fromVision.contactEmail);

  // El modo de contacto debe acompañar al dato, porque los campos solo se
  // muestran cuando el modo coincide (PHONE, WHATSAPP o EMAIL).
  if (result.contactPhone) result.contactMode = 'PHONE';
  else if (result.contactWhatsapp) result.contactMode = 'WHATSAPP';
  else if (result.contactEmail) result.contactMode = 'EMAIL';

  // La ubicación se reconcilia al final: el municipio manda sobre la provincia
  // porque es más específico.
  if (result.municipality) {
    const municipality =
      matchMunicipalityExact(result.municipality, result.province) ??
      findMunicipality(result.municipality, result.province);

    if (municipality) {
      result.province = municipality.province;
      result.municipality = municipality.municipality;
    } else {
      // El `<select>` solo acepta municipios canónicos: mejor omitirlo.
      delete result.municipality;
    }
  }

  // La zona puede completar la ubicación cuando el aviso solo trae un reparto o
  // una referencia. No se sobrescribe lo que ya venga del texto o de la visión.
  if (result.zone) {
    const zoneInfo = findCubaZone(result.zone, {
      province: result.province,
      municipality: result.municipality,
    });

    if (zoneInfo) {
      if (!result.province) result.province = zoneInfo.province;
      if (!result.municipality) result.municipality = zoneInfo.municipality;
    }
  }

  const coordinates = resolveCoordinates(result);
  if (coordinates.latitude !== undefined && coordinates.longitude !== undefined) {
    result.latitude = coordinates.latitude;
    result.longitude = coordinates.longitude;
    result.locationPrecision = coordinates.locationPrecision;
  }

  // El título y la descripción se ofrecen como sugerencia; el cliente solo los
  // aplica si el usuario no ha escrito nada.
  if (!result.title) {
    const title = composeTitle(result);
    if (title) result.title = title;
  }

  if (!result.description) {
    const description = composeDescription(result, ocrText);
    if (description) result.description = description;
  }

  if (ocrText) result.ocrText = ocrText.slice(0, 2000);

  // Confianza: media de las fuentes que aportaron algo. Vision no devuelve una
  // confianza global, así que se usa el 0.85 que ya documentaba el handler.
  const sourceConfidences: number[] = [];
  if (ocrText) sourceConfidences.push(clampConfidence(input.ocr?.confidence) || 0.5);
  if (input.vision) sourceConfidences.push(0.85);

  result.confidence =
    sourceConfidences.length > 0
      ? sourceConfidences.reduce((sum, value) => sum + value, 0) / sourceConfidences.length
      : 0;

  return result;
}
