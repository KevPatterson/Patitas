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

/**
 * Sustantivo de la especie en masculino y femenino.
 */
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

/**
 * Sustantivos femeninos que no terminan en «a». «ave» es femenino aunque el
 * aviso sea de un macho, así que el demostrativo debe concordar con la palabra
 * y no con el sexo del animal.
 */
const FEMININE_NOUNS = new Set(['ave']);

function isPublicationType(value: string): value is PublicationType {
  return Object.prototype.hasOwnProperty.call(RESOLVED_OUTCOMES, value);
}

function speciesNounData(species?: string | null) {
  return SPECIES_NOUNS[(species ?? '').toLowerCase()] ?? DEFAULT_SPECIES_NOUN;
}

/** Devuelve el sustantivo de la especie concordando con el sexo del aviso. */
export function getSpeciesNoun(species?: string | null, sex?: string | null): string {
  const nouns = speciesNounData(species);
  return sex === 'female' ? nouns.female : nouns.male;
}

/** Demostrativo que concuerda con el sustantivo («este perro», «esta ave»). */
function getDemonstrative(noun: string): string {
  return FEMININE_NOUNS.has(noun) || noun.endsWith('a') ? 'esta' : 'este';
}

export type ResolvedCelebrationCopy = {
  title: string;
  subtitle: string;
};

/**
 * Compone el mensaje de una publicación resuelta a partir del tipo de caso.
 *
 * El sujeto es el nombre de la mascota si el título lo permite; si no, se usa
 * la especie. El posesivo «tu» solo es correcto para quien publicó el aviso:
 * un visitante lee «Este perro encontró un hogar», nunca «Tu perro». Tomar la
 * primera palabra del título producía «¡Perra está de vuelta en casa!» sin
 * nombre ni concordancia.
 */
export function getResolvedCelebrationCopy(input: {
  title?: string | null;
  type?: string | null;
  species?: string | null;
  sex?: string | null;
  /** Quien lee el mensaje es el dueño de la publicación. */
  isOwner?: boolean;
}): ResolvedCelebrationCopy {
  const isOwner = input.isOwner ?? true;
  const name = getPetNameFromTitle(input.title);
  const type = (input.type ?? '').toUpperCase();
  const knownType = isPublicationType(type) ? type : 'LOST';
  const noun = getSpeciesNoun(input.species, input.sex);

  const subject = name ?? (isOwner ? `tu ${noun}` : `${getDemonstrative(noun)} ${noun}`);

  const outcome = RESOLVED_OUTCOMES[knownType];

  return {
    title: `¡${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${outcome}!`,
    subtitle: RESOLVED_SUBTITLES[knownType],
  };
}
