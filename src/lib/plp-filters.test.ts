import { describe, it, expect } from 'vitest';
import { parsePlp, plpWhere, removeParamHref } from './plp-filters';

describe('parsePlp', () => {
  it('parses defaults for an empty query', () => {
    const s = parsePlp({});
    expect(s).toEqual({
      q: undefined, brand: undefined, category: undefined, kind: undefined,
      sort: 'popular', instock: false, offers: false,
      pminEgp: undefined, pmaxEgp: undefined, rating: undefined, exp: undefined, attrs: {},
    });
  });

  it('parses full state incl. dynamic attribute params', () => {
    const s = parsePlp({
      q: ' omega ', brand: 'b1', category: 'c1', kind: 'DEVICE', sort: 'price_asc',
      instock: '1', offers: '1', pmin: '100', pmax: '500.5', rating: '4', exp: 'lt3',
      av_form: 'v-caps', av_diet: 'v-vegan',
    });
    expect(s.q).toBe('omega');
    expect(s.pminEgp).toBe(100);
    expect(s.pmaxEgp).toBe(500.5);
    expect(s.rating).toBe(4);
    expect(s.exp).toBe('lt3');
    expect(s.attrs).toEqual({ form: 'v-caps', diet: 'v-vegan' });
  });

  it('rejects invalid rating / exp / prices', () => {
    const s = parsePlp({ rating: '9', exp: 'nope', pmin: '-5', pmax: 'abc' });
    expect(s.rating).toBeUndefined();
    expect(s.exp).toBeUndefined();
    expect(s.pminEgp).toBeUndefined();
    expect(s.pmaxEgp).toBeUndefined();
  });

  it('takes the first value of repeated params', () => {
    expect(parsePlp({ brand: ['b1', 'b2'] }).brand).toBe('b1');
  });
});

describe('plpWhere', () => {
  const now = new Date('2026-07-07T00:00:00Z');
  const day = (n: number) => new Date(now.getTime() + n * 86_400_000);

  it('converts the EGP price range to piastres bounds', () => {
    const w = plpWhere(parsePlp({ pmin: '100', pmax: '250' }), now);
    expect(w.basePricePiastres).toEqual({ gte: 10000n, lte: 25000n });
  });

  it('ANDs lot-based facets instead of overwriting each other', () => {
    const w = plpWhere(parsePlp({ instock: '1', offers: '1', exp: 'lt3' }), now);
    const ands = w.AND as Record<string, unknown>[];
    expect(ands).toHaveLength(3);
    expect(ands[0]).toEqual({ lots: { some: { status: 'LIVE', qtyOnHand: { gt: 0 } } } });
    expect(ands[1]).toEqual({ lots: { some: { saleFlag: true } } });
    expect(ands[2]).toEqual({ lots: { some: { status: 'LIVE', qtyOnHand: { gt: 0 }, expiryDate: { gt: now, lte: day(90) } } } });
  });

  it('6+ months window includes non-perishable (null expiry) lots', () => {
    const w = plpWhere(parsePlp({ exp: 'gt6' }), now);
    const ands = w.AND as Record<string, unknown>[];
    expect(ands[0]).toEqual({
      lots: { some: { status: 'LIVE', qtyOnHand: { gt: 0 }, OR: [{ expiryDate: { gt: day(180) } }, { expiryDate: null }] } },
    });
  });

  it('adds one AND clause per selected attribute value', () => {
    const w = plpWhere(parsePlp({ av_a1: 'v1', av_a2: 'v2' }));
    const ands = w.AND as Record<string, unknown>[];
    expect(ands).toEqual([
      { attributeValues: { some: { attributeValueId: 'v1' } } },
      { attributeValues: { some: { attributeValueId: 'v2' } } },
    ]);
  });

  it('rating facet requires rated products', () => {
    const w = plpWhere(parsePlp({ rating: '4' }));
    expect(w.ratingAvg).toEqual({ gte: 4 });
    expect(w.ratingCount).toEqual({ gt: 0 });
  });
});

describe('removeParamHref', () => {
  it('drops the named params and keeps the rest', () => {
    expect(removeParamHref('/products', { brand: 'b1', rating: '4', q: 'omega' }, ['rating'])).toBe('/products?brand=b1&q=omega');
  });

  it('returns the bare base when nothing remains', () => {
    expect(removeParamHref('/products', { brand: 'b1' }, ['brand'])).toBe('/products');
  });
});
