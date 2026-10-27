import { describe, expect, it } from 'vitest';
import {
  countSuccessStories,
  filterSuccessStories,
  getSuccessStoryKind,
} from '../success-stories';

describe('success stories', () => {
  it('clasifica las adopciones como adoptados y el resto como reencuentros', () => {
    expect(getSuccessStoryKind('ADOPTION')).toBe('ADOPTED');
    expect(getSuccessStoryKind('LOST')).toBe('REUNITED');
    expect(getSuccessStoryKind('FOUND')).toBe('REUNITED');
    expect(getSuccessStoryKind('ABANDONED')).toBe('REUNITED');
    expect(getSuccessStoryKind('SIGHTING')).toBe('REUNITED');
  });

  it('filtra sin mutar la lista original', () => {
    const stories = [{ type: 'ADOPTION' as const }, { type: 'LOST' as const }];

    expect(filterSuccessStories(stories, 'ALL')).toHaveLength(2);
    expect(filterSuccessStories(stories, 'ADOPTED')).toEqual([{ type: 'ADOPTION' }]);
    expect(filterSuccessStories(stories, 'REUNITED')).toEqual([{ type: 'LOST' }]);
    expect(stories).toHaveLength(2);
  });

  it('cuenta cada tipo de final feliz', () => {
    const stories = [
      { type: 'ADOPTION' as const },
      { type: 'LOST' as const },
      { type: 'FOUND' as const },
    ];

    expect(countSuccessStories(stories)).toEqual({ REUNITED: 2, ADOPTED: 1 });
  });
});
