import { getPetNameFromTitle } from './pet-name';
import type { PublicationType } from '../../types';

/**
 * Desenlace que describe cada tipo de aviso al resolverse.
 *
 * Un aviso de pérdida termina con la mascota de vuelta en casa, pero una
 * adopción o un abandono terminan con una mascota que encontró hogar. Usar
 * siempre «volvió a casa» daba mensajes falsos en esos casos.
 */
const RESOLVED_OUTCOMES: Record<PublicationType, string> = {
  LOST: 'volvió a casa',
  FOUND: 'encontró a su familia',
  ADOPTION: 'encontró una casa',
  ABANDONED: 'encontró un hogar',
  SIGHTING: 'está a salvo',
};

/** Texto de apoyo de cada tipo de caso, sin dar por hecho que se perdió. */
const RESOLVED_SUBTITLES: Record<PublicationType, string> = {
  LOST: 'Gracias a todas las personas que ayudaron a compartir este caso. Juntos hacemos que las mascotas regresen con sus familias.',
  FOUND: 'Gracias a quien encontró a esta mascota y a todas las personas que compartieron el aviso para que volviera con su familia.',
  ADOPTION:
    'Esta mascota ya tiene un hogar. Gracias a quienes compartieron su historia y a la familia que le dio una segunda oportunidad.',
  ABANDONED:
    'Esta mascota ya tiene un hogar. Gracias a quienes se preocuparon por este caso y le dieron un nuevo comienzo.',
  SIGHTING:
    'Gracias a todas las personas que compartieron el aviso. Los datos del avistamiento ayudaron a resolver el caso.',
};

/** Sustantivo de la especie en masculino y femenino. */
const SPECIES_NOUNS: Record<string, { male: string; female: string }> = {
  dog: { male: 'perro', female: 'perra' },
  cat: { male: 'gato', female: 'gata' },
  bird: { male: 'ave', female: 'ave' },
  rabbit: { male: 'conejo', female: 'coneja' },
  rodent: { male: 'roedor', female: 'roedora' },
  reptile: { male: 'reptil', female: 'reptil' },
  other: { male: 'mascota', female: 'mascota' },
};

const DEFAULT_SPECIES_NOUN = { male: 'mascota', female: 'mascota' };

function isPublicationType(value: string): value is PublicationType {
  return Object.prototype.hasOwnProperty.call(RESOLVED_OUTCOMES, value);
}

/** Devuelve el sustantivo de la especie concordando con el sexo del aviso. */
export function getSpeciesNoun(species?: string | null, sex?: string | null): string {
  const nouns = SPECIES_NOUNS[(species ?? '').toLowerCase()] ?? DEFAULT_SPECIES_NOUN;
  return sex === 'female' ? nouns.female : nouns.male;
}

export type ResolvedCelebrationCopy = {
  title: string;
  subtitle: string;
};

/**
 * Compone el mensaje de una publicación resuelta a partir del tipo de caso.
 *
 * El sujeto es el nombre de la mascota si el título lo permite; si no, se usa
 * la especie («Tu perra volvió a casa»). Tomar la primera palabra del título
 * producía «¡Perra está de vuelta en casa!» sin nombre ni concordancia.
 */
export function getResolvedCelebrationCopy(input: {
  title?: string | null;
  type?: string | null;
  species?: string | null;
  sex?: string | null;
}): ResolvedCelebrationCopy {
  const name = getPetNameFromTitle(input.title);
  const type = (input.type ?? '').toUpperCase();
  const knownType = isPublicationType(type) ? type : 'LOST';
  const subject = name ?? `tu ${getSpeciesNoun(input.species, input.sex)}`;
  const outcome = RESOLVED_OUTCOMES[knownType];

  return {
    title: `¡${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${outcome}!`,
    subtitle: RESOLVED_SUBTITLES[knownType],
  };
}
