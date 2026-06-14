import { describe, expect, it } from 'vitest';
import { uniqueSlug } from './slug';

describe('uniqueSlug', () => {
  it('returns the base slug when free', async () => {
    expect(await uniqueSlug('New Vitamin', async () => false)).toBe('new-vitamin');
  });
  it('appends a suffix on collision', async () => {
    const taken = new Set(['vitamin-c', 'vitamin-c-2']);
    expect(await uniqueSlug('Vitamin C', async (s) => taken.has(s))).toBe('vitamin-c-3');
  });
});
