import { describe, it, expect } from 'vitest';
import { renderSearchDigest, type SearchDigestData } from './search-digest';

const base: SearchDigestData = {
  from: new Date('2026-07-05T00:00:00Z'),
  to: new Date('2026-07-12T00:00:00Z'),
  totalSearches: 240,
  ctr: 0.42,
  zeroRate: 0.08,
  soldClicks: 31,
  topTerms: [{ term: 'vitamin c', searches: 40 }, { term: 'omega 3', searches: 22 }],
  zeroTerms: [{ term: 'ashwaganda', searches: 12 }],
  drivingTerms: [{ term: 'vitamin c', soldClicks: 9 }],
  outOfStock: [{ name: 'Ester-C 1000mg', clicks: 7 }],
};

describe('renderSearchDigest', () => {
  it('puts headline metrics and the date range in the subject/body', () => {
    const { subject, body } = renderSearchDigest(base);
    expect(subject).toContain('2026-07-12');
    expect(subject).toContain('240');
    expect(body).toContain('2026-07-05 to 2026-07-12');
    expect(body).toContain('Click-through: 42%');
    expect(body).toContain('Zero-result: 8%');
    expect(body).toContain('Clicks that sold: 31');
  });

  it('lists each section, using (none) when empty', () => {
    const { body } = renderSearchDigest({ ...base, zeroTerms: [], outOfStock: [] });
    expect(body).toContain('vitamin c — 40');
    expect(body).toContain('vitamin c — 9 sold');
    // Empty sections fall back to a placeholder rather than vanishing.
    expect(body).toMatch(/Zero-result searches[\s\S]*\(none\)/);
    expect(body).toMatch(/out of stock[\s\S]*\(none\)/);
  });

  it('caps each list at 10 rows', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ term: `t${i}`, searches: 25 - i }));
    const { body } = renderSearchDigest({ ...base, topTerms: many });
    expect(body).toContain('t0 — 25');
    expect(body).toContain('t9 — 16');
    expect(body).not.toContain('t10 — ');
  });
});
