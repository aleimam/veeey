import { describe, expect, it } from 'vitest';
import { dedupeKeepOrder, rankByAffinity, topByFrequency } from './personalization';

describe('personalization helpers', () => {
  it('dedupeKeepOrder keeps first occurrence', () => {
    expect(dedupeKeepOrder(['a', 'b', 'a', 'c', 'b'], (x) => x)).toEqual(['a', 'b', 'c']);
  });

  it('rankByAffinity boosts category-matching items, stable on ties', () => {
    const items = [
      { id: '1', categoryIds: ['x'] },
      { id: '2', categoryIds: ['energy', 'immunity'] },
      { id: '3', categoryIds: ['immunity'] },
      { id: '4', categoryIds: ['x'] },
    ];
    const ranked = rankByAffinity(items, new Set(['immunity', 'energy']));
    expect(ranked.map((r) => r.id)).toEqual(['2', '3', '1', '4']); // 2 matches, then 1 match, then originals
  });

  it('topByFrequency ranks by count then first-seen', () => {
    expect(topByFrequency(['a', 'b', 'a', 'c', 'a', 'b'], 2)).toEqual(['a', 'b']);
    expect(topByFrequency(['x', 'y', 'z'], 5)).toEqual(['x', 'y', 'z']);
  });
});
