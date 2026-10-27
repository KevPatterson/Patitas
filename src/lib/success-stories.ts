import type { PublicationSummary } from './supabase/publication-search';

/**
 * Clasificación de los finales felices.
 *
 * Una adopción resuelta es una adopción consumada; el resto de tipos resueltos
 * (perdidos, encontrados, abandonados o avistamientos) representan un
 * reencuentro con su familia o su rescate.
 */
export type SuccessStoryKind = 'REUNITED' | 'ADOPTED';
export type SuccessStoryFilter = 'ALL' | SuccessStoryKind;

export const SUCCESS_STORY_LABELS: Record<SuccessStoryKind, string> = {
  REUNITED: 'Reencontrado',
  ADOPTED: 'Adoptado',
};

export function getSuccessStoryKind(type: PublicationSummary['type']): SuccessStoryKind {
  return type === 'ADOPTION' ? 'ADOPTED' : 'REUNITED';
}

export function filterSuccessStories<T extends { type: PublicationSummary['type'] }>(
  stories: T[],
  filter: SuccessStoryFilter
): T[] {
  if (filter === 'ALL') return stories;
  return stories.filter((story) => getSuccessStoryKind(story.type) === filter);
}

export function countSuccessStories<T extends { type: PublicationSummary['type'] }>(
  stories: T[]
): Record<SuccessStoryKind, number> {
  return stories.reduce<Record<SuccessStoryKind, number>>(
    (counts, story) => {
      counts[getSuccessStoryKind(story.type)] += 1;
      return counts;
    },
    { REUNITED: 0, ADOPTED: 0 }
  );
}
