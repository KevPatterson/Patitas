/**
 * Palabras que aparecen al inicio de un título pero no son el nombre de la
 * mascota.
 *
 * Los títulos se escriben a mano ("Perra encontrada en Centro Habana") o los
 * compone la extracción ("Perro perdido en Playa"). Tomar la primera palabra
 * como nombre producía mensajes como «¡Perra está de vuelta en casa!».
 */
const NOT_A_PET_NAME = new Set([
  // Género, especie y edad
  'perro', 'perra', 'perrito', 'perrita', 'gato', 'gata', 'gatito', 'gatita',
  'cachorro', 'cachorra', 'mascota', 'animal', 'ave', 'pajaro', 'pajara',
  'conejo', 'coneja', 'roedor', 'reptil', 'serpiente', 'tortuga', 'loro',
  'periquito', 'hamster', 'mestizo', 'mestiza', 'criollo', 'criolla',
  'callejero', 'callejera',
  // Estado del aviso
  'perdido', 'perdida', 'encontrado', 'encontrada', 'desaparecido',
  'desaparecida', 'extraviado', 'extraviada', 'robado', 'robada', 'rescatado',
  'rescatada', 'abandonado', 'abandonada', 'avistado', 'avistada', 'adoptado',
  'adoptada', 'adopcion', 'en', 'de', 'del', 'al', 'para', 'con', 'sin', 'por',
  'y', 'se', 'busca', 'busco', 'buscamos', 'ayuda', 'ayudame', 'ayudenme',
  'urgente', 'atencion', 'aviso', 'informacion', 'hogar', 'transito',
  // Artículos y posesivos
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'mi', 'mis',
  'nuestro', 'nuestra', 'nuestros', 'nuestras', 'su', 'sus', 'este', 'esta',
  'estos', 'estas', 'ese', 'esa',
  // Nombres de lugar frecuentes al inicio
  'centro', 'habana', 'vedado', 'playa', 'miramar', 'cuba',
]);

/** Quita comillas, dos puntos y signos de los extremos de una palabra. */
function cleanWord(value: string): string {
  return value.replace(/^[^\p{L}]+|[^\p{L}'-]+$/gu, '');
}

/** Normaliza para comparar sin tildes, mayúsculas ni puntuación. */
function normalizeWord(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Deduce el nombre de la mascota a partir del título de la publicación.
 *
 * Solo se acepta la primera palabra con letras si no es una palabra común de
 * especie, estado, artículo o lugar. Así "Toby perdido en Playa" devuelve
 * `Toby`, mientras que "Perra encontrada en Centro Habana" no devuelve nada y
 * la celebración usa un texto genérico.
 */
export function getPetNameFromTitle(title?: string | null): string | undefined {
  const words = (title ?? '')
    .trim()
    .split(/\s+/)
    .map(cleanWord)
    .filter(Boolean);

  const candidate = words[0];
  if (!candidate) return undefined;

  if (candidate.length < 2 || candidate.length > 24) return undefined;
  if (NOT_A_PET_NAME.has(normalizeWord(candidate))) return undefined;

  return candidate;
}
