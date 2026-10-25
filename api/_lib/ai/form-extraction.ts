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
 */

export type FormSpecies = 'dog' | 'cat' | 'bird' | 'rabbit' | 'rodent' | 'reptile' | 'other';
export type FormSize = 'small' | 'medium' | 'large';
export type FormSex = 'male' | 'female';
export type FormAge = 'puppy' | 'young' | 'adult' | 'senior';
export type FormContactMode = 'INTERNAL' | 'PHONE' | 'WHATSAPP' | 'EMAIL';

export type FormExtraction = {
  species?: FormSpecies;
  breed?: string;
  color?: string;
  size?: FormSize;
  sex?: FormSex;
  ageApprox?: FormAge;
  characteristics?: string;
  collar?: boolean;
  plate?: boolean;
  province?: string;
  municipality?: string;
  zone?: string;
  reward?: string;
  eventDate?: string;
  eventTimeApprox?: string;
  contactMode?: FormContactMode;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactEmail?: string;
  petName?: string;
  /** Texto reconocido en la imagen, para que el usuario pueda contrastarlo. */
  ocrText?: string;
  hasTextOverlay: boolean;
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

const SPECIES_PATTERNS: Array<[FormSpecies, RegExp]> = [
  ['dog', /\b(perr[oa]s?|dog|dogs|canino|cachorr[oa]s?)\b/i],
  ['cat', /\b(gat[oa]s?|cat|cats|felino)\b/i],
  ['bird', /\b(ave|aves|p[aá]jaro|p[aá]jara|bird|loro|cotorra|periquito)\b/i],
  ['rabbit', /\b(conejo|coneja|conejos|rabbit|bunny)\b/i],
  ['rodent', /\b(roedor|roedores|h[aá]mster|hamster|cobaya|rat[oó]n|mouse)\b/i],
  ['reptile', /\b(reptil|reptiles|tortuga|iguana|serpiente|snake|lizard)\b/i],
];

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

/** Quita tildes para comparar provincias aunque el OCR las pierda. */
function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value: string): string {
  return stripDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();
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

/**
 * Extrae datos estructurados del texto reconocido por OCR.
 *
 * Solo devuelve lo que aparece literalmente en el texto. El teléfono se
 * normaliza a `+53XXXXXXXX` y la provincia se devuelve con su nombre canónico
 * (antes `Pinar del Río` salía como `Pinar Del Río` y no coincidía con el
 * `<option>` del formulario).
 */
export function extractStructuredDataFromText(text: string): Partial<FormExtraction> {
  const result: Partial<FormExtraction> = {};
  if (!text.trim()) return result;

  const species = firstMatch(SPECIES_PATTERNS, text);
  if (species) result.species = species;

  const size = firstMatch(SIZE_PATTERNS, text);
  if (size) result.size = size;

  const sex = firstMatch(SEX_PATTERNS, text);
  if (sex) result.sex = sex;

  const age = firstMatch(AGE_PATTERNS, text);
  if (age) result.ageApprox = age;

  const color = findColors(text);
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

  const dateMatch = text.match(
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})|(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i
  );
  if (dateMatch) result.eventDate = dateMatch[0];

  const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\s?(am|pm|a\.\s?m\.|p\.\s?m\.)?/i);
  if (timeMatch) result.eventTimeApprox = timeMatch[0];

  const normalized = normalizeText(text);
  const province = PROVINCES.find((name) => normalized.includes(normalizeText(name)));
  if (province) result.province = province;

  // Nombre de la mascota: solo si el texto lo declara explícitamente.
  const nameMatch = text.match(/(?:se llama|nombre|responde a)\s*:?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,20})/);
  if (nameMatch?.[1]) result.petName = nameMatch[1];

  return result;
}

/**
 * Traduce las etiquetas y la descripción de Google Vision a atributos del
 * formulario. No completa campos "por defecto": si no hay evidencia, se omite.
 */
export function extractAttributesFromVision(vision: VisionInput): Partial<FormExtraction> {
  const result: Partial<FormExtraction> = {};
  const labels = vision.labels.map((item) => item.label.toLowerCase());
  const haystack = `${labels.join(' ')} ${(vision.description ?? '').toLowerCase()}`;

  const species = firstMatch(SPECIES_PATTERNS, haystack);
  if (species) result.species = species;

  const size = firstMatch(SIZE_PATTERNS, haystack);
  if (size) result.size = size;

  const sex = firstMatch(SEX_PATTERNS, haystack);
  if (sex) result.sex = sex;

  const age = firstMatch(AGE_PATTERNS, haystack);
  if (age) result.ageApprox = age;

  const color = findColors(haystack);
  if (color) result.color = color;

  if (/\bcollar\b/.test(haystack)) result.collar = true;
  if (/\b(tag|placa|plate|medalla|chapita)\b/.test(haystack)) result.plate = true;

  const features: string[] = [];
  if (/\bcollar\b/.test(haystack)) features.push('usa collar');
  if (/\b(outdoor|grass|park|street)\b/.test(haystack)) features.push('fotografiado al aire libre');
  if (/\b(friendly|happy)\b/.test(haystack)) features.push('aspecto amigable');
  if (features.length > 0) result.characteristics = features.join(', ');

  return result;
}

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

  const assign = <K extends keyof FormExtraction>(key: K, value: FormExtraction[K] | undefined) => {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  };

  assign('species', fromVision.species ?? fromOcr.species);
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
  assign('reward', fromOcr.reward ?? fromVision.reward);
  assign('eventDate', fromOcr.eventDate ?? fromVision.eventDate);
  assign('eventTimeApprox', fromOcr.eventTimeApprox ?? fromVision.eventTimeApprox);
  assign('petName', fromOcr.petName ?? fromVision.petName);

  assign('contactPhone', fromOcr.contactPhone ?? fromVision.contactPhone);
  assign('contactWhatsapp', fromOcr.contactWhatsapp ?? fromVision.contactWhatsapp);
  assign('contactEmail', fromOcr.contactEmail ?? fromVision.contactEmail);

  // El modo de contacto debe acompañar al dato, porque los campos solo se
  // muestran cuando el modo coincide (PHONE, WHATSAPP o EMAIL).
  if (result.contactPhone) result.contactMode = 'PHONE';
  else if (result.contactWhatsapp) result.contactMode = 'WHATSAPP';
  else if (result.contactEmail) result.contactMode = 'EMAIL';

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
