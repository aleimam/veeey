import { describe, expect, it } from 'vitest';
import { slugify, brandCode, skuFromParts, generateSku } from './sku';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Dr Berg’s Vitamin C')).toBe('dr-berg-s-vitamin-c');
  });
  it('strips diacritics and collapses separators', () => {
    expect(slugify('  NOW®  Foods ')).toBe('now-foods');
  });
});

describe('brandCode', () => {
  it('takes the first three letters uppercased', () => {
    expect(brandCode('Solgar')).toBe('SOL');
    expect(brandCode('NOW')).toBe('NOW');
  });
  it('falls back to GEN for empty input', () => {
    expect(brandCode('—')).toBe('GEN');
  });
});

describe('skuFromParts / generateSku', () => {
  it('pads the sequence to 5 digits', () => {
    expect(skuFromParts('SOL', 42)).toBe('VEY-SOL-00042');
  });
  it('is deterministic for a given brand + sequence', () => {
    expect(generateSku('Solgar', 1)).toBe('VEY-SOL-00001');
    expect(generateSku('Solgar', 1)).toBe('VEY-SOL-00001');
  });
});
