import { describe, it, expect } from 'vitest';
import { normalizeQuery, isPlaceholderTerm } from './search-normalize';

describe('isPlaceholderTerm (V5 audit F7)', () => {
  it('flags the literal sitelinks template token', () => {
    expect(isPlaceholderTerm('{search_term_string}')).toBe(true);
  });

  it('flags URL-encoded braces', () => {
    expect(isPlaceholderTerm('%7Bsearch_term_string%7D')).toBe(true);
    expect(isPlaceholderTerm('%7bsearch_term_string%7d')).toBe(true);
  });

  it('flags the bare token and any braced junk', () => {
    expect(isPlaceholderTerm('search_term_string')).toBe(true);
    expect(isPlaceholderTerm('{{query}}')).toBe(true);
    expect(isPlaceholderTerm('vitamin {d}')).toBe(true);
  });

  it('does NOT flag real searches (EN + AR)', () => {
    expect(isPlaceholderTerm('vitamin d3')).toBe(false);
    expect(isPlaceholderTerm('Omega-3 1000mg')).toBe(false);
    expect(isPlaceholderTerm('فيتامين د')).toBe(false);
    expect(isPlaceholderTerm('')).toBe(false);
  });
});

describe('normalizeQuery', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeQuery('  Vit   D3 ')).toBe('vit d3');
  });

  it('folds Arabic variants', () => {
    expect(normalizeQuery('أوميغا')).toBe('اوميغا');
    expect(normalizeQuery('مستشفى')).toBe('مستشفي');
  });
});
