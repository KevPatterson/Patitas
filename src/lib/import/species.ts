import { SPECIES_LABELS } from '../constants/labels';

/**
 * Alias que puede devolver la IA para la especie.
 *
 * `buildFormExtraction` ya entrega las claves del formulario (`dog`, `cat`),
 * pero los endpoints aceptan respuestas antiguas y el modelo de visión a veces
 * contesta con la etiqueta en español. Sin esta normalización el `<select>`
 * quedaba vacío aunque la especie se hubiera detectado.
 */
const SPECIES_ALIASES: Record<string, string> = {
  perro: 'dog',
  perra: 'dog',
  perros: 'dog',
  perras: 'dog',
  dog: 'dog',
  dogs: 'dog',
  canino: 'dog',
  canina: 'dog',
  cachorro: 'dog',
  cachorra: 'dog',
  gato: 'cat',
  gata: 'cat',
  gatos: 'cat',
  gatas: 'cat',
  cat: 'cat',
  cats: 'cat',
  felino: 'cat',
  felina: 'cat',
  ave: 'bird',
  aves: 'bird',
  pajaro: 'bird',
  pajara: 'bird',
  bird: 'bird',
  loro: 'bird',
  cotorra: 'bird',
  periquito: 'bird',
  conejo: 'rabbit',
  coneja: 'rabbit',
  conejos: 'rabbit',
  rabbit: 'rabbit',
  bunny: 'rabbit',
  roedor: 'rodent',
  roedores: 'rodent',
  hamster: 'rodent',
  cobaya: 'rodent',
  raton: 'rodent',
  rodent: 'rodent',
  reptil: 'reptile',
  reptiles: 'reptile',
  tortuga: 'reptile',
  iguana: 'reptile',
  serpiente: 'reptile',
  reptile: 'reptile',
  otro: 'other',
  otra: 'other',
  other: 'other',
  mascota: 'other',
};

function normalizeKey(value?: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Normaliza una especie al valor que acepta el `<select>` del formulario.
 *
 * Acepta la clave (`dog`), la etiqueta en español (`Perro`) y variantes como
 * `perro mestizo` o `gato doméstico`. Devuelve `undefined` si no hay una
 * especie reconocible: nunca se inventa una.
 */
export function normalizeSpeciesValue(value?: string): string | undefined {
  const key = normalizeKey(value);
  if (!key) return undefined;

  if (key in SPECIES_LABELS) return key;

  const exact = SPECIES_ALIASES[key];
  if (exact) return exact;

  if (/\b(perr|dog|canin)/.test(key)) return 'dog';
  if (/\b(gat|cat|felin)/.test(key)) return 'cat';
  if (/\b(ave|pajaro|bird|loro|cotorra|periquito)/.test(key)) return 'bird';
  if (/\b(conejo|rabbit|bunny)/.test(key)) return 'rabbit';
  if (/\b(roedor|hamster|cobaya|raton|mouse|rodent)/.test(key)) return 'rodent';
  if (/\b(reptil|tortuga|iguana|serpiente|snake|lizard)/.test(key)) return 'reptile';
  if (/\b(otro|otra|other|mascota)/.test(key)) return 'other';

  return undefined;
}
