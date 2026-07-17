import { describe, it, expect } from 'vitest';
import { decodeEntities, decodePercentSlug } from './decode-entities';

// V7 audit C1: the only entity actually in production is &amp; (218 products,
// 6 brands, 14 categories), but the decoder handles what WP can emit.
describe('decodeEntities', () => {
  it('decodes the production case', () => {
    expect(decodeEntities('Brain &amp; Cognitive Health')).toBe('Brain & Cognitive Health');
    expect(decodeEntities('Pain &amp; Relief Supplements')).toBe('Pain & Relief Supplements');
  });

  it('decodes named and numeric entities WP emits in titles', () => {
    expect(decodeEntities('Omega&ndash;3 &copy; 2026')).toBe('Omega–3 © 2026');
    expect(decodeEntities('Vitamin D &#8211; 5000 IU')).toBe('Vitamin D – 5000 IU');
    expect(decodeEntities('Kids&#x2019; Multi')).toBe('Kids’ Multi');
  });

  it('is SINGLE pass — one escape level is one decode', () => {
    // Double-escaped text decodes one level, not to destruction.
    expect(decodeEntities('A &amp;amp; B')).toBe('A &amp; B');
  });

  it('leaves unknown entities and bare ampersands visible', () => {
    expect(decodeEntities('Fish & Krill')).toBe('Fish & Krill');
    expect(decodeEntities('&bogus; stays')).toBe('&bogus; stays');
    expect(decodeEntities('AT&T style')).toBe('AT&T style');
  });

  it('refuses control characters from numeric entities', () => {
    expect(decodeEntities('bad &#0; char')).toBe('bad &#0; char');
    expect(decodeEntities('bad &#8; char')).toBe('bad &#8; char');
  });

  it('passes clean strings through untouched', () => {
    expect(decodeEntities('Whey Protein 2kg')).toBe('Whey Protein 2kg');
    expect(decodeEntities('فيتامين سي')).toBe('فيتامين سي');
  });
});

// V7 audit C4: two category slugs arrived percent-encoded from WP; encoded
// slugs never match a lookup because Next decodes query params on arrival.
describe('decodePercentSlug', () => {
  it('decodes percent-encoded Arabic slugs', () => {
    expect(decodePercentSlug('%d9%85%d9%83%d8%a7%d9%81%d8%ad%d8%a9-%d8%a7%d9%84%d8%b4%d9%8a%d8%ae%d9%88%d8%ae%d8%a9')).toBe('مكافحة-الشيخوخة');
  });

  it('leaves plain slugs and malformed encodings untouched', () => {
    expect(decodePercentSlug('pain-relief')).toBe('pain-relief');
    expect(decodePercentSlug('50%-off')).toBe('50%-off'); // bad escape must not throw
  });
});
