import { describe, it, expect } from 'vitest';
import { normalizeQuery } from './search-normalize';

describe('normalizeQuery', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeQuery('  Vitamin   D3  ')).toBe('vitamin d3');
    expect(normalizeQuery('VIT-D')).toBe('vit-d');
  });
  it('folds Arabic alef/yaa/taa variants and strips tashkeel', () => {
    expect(normalizeQuery('أوميغا')).toBe('اوميغا');
    expect(normalizeQuery('فيتامين')).toBe('فيتامين');
    expect(normalizeQuery('مُكمّل')).toBe('مكمل');
    expect(normalizeQuery('حبوب منوّمة')).toBe(normalizeQuery('حبوب منومه'));
  });
  it('is idempotent and matches case/spacing variants to the same key', () => {
    expect(normalizeQuery('Vit  D')).toBe(normalizeQuery('vit d'));
    expect(normalizeQuery(normalizeQuery('Vitamin D'))).toBe(normalizeQuery('Vitamin D'));
  });
});
