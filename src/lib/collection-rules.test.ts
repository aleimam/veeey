import { describe, it, expect } from 'vitest';
import { buildRuleWhere, conditionWhere, parseRule, ruleOrderBy, type RuleConfig } from './collection-rules';

describe('collection rule engine', () => {
  it('compiles category / tag / brand / attribute (is + is_not)', () => {
    expect(conditionWhere({ field: 'category', op: 'is', value: 'c1' })).toEqual({ categories: { some: { id: 'c1' } } });
    expect(conditionWhere({ field: 'category', op: 'is_not', value: 'c1' })).toEqual({ NOT: { categories: { some: { id: 'c1' } } } });
    expect(conditionWhere({ field: 'tag', op: 'is', value: 't1' })).toEqual({ tags: { some: { id: 't1' } } });
    expect(conditionWhere({ field: 'brand', op: 'is', value: 'b1' })).toEqual({ brandId: 'b1' });
    expect(conditionWhere({ field: 'brand', op: 'is_not', value: 'b1' })).toEqual({ NOT: { brandId: 'b1' } });
    expect(conditionWhere({ field: 'attribute', op: 'is', value: 'av1' })).toEqual({ attributeValues: { some: { attributeValueId: 'av1' } } });
  });

  it('converts price EGP → piastres (BigInt) and orders between', () => {
    expect(conditionWhere({ field: 'price', op: 'gt', value: 100 })).toEqual({ basePricePiastres: { gt: 10000n } });
    expect(conditionWhere({ field: 'price', op: 'lt', value: 50 })).toEqual({ basePricePiastres: { lt: 5000n } });
    // between normalizes hi/lo regardless of order
    expect(conditionWhere({ field: 'price', op: 'between', value: 200, value2: 100 })).toEqual({ basePricePiastres: { gte: 10000n, lte: 20000n } });
  });

  it('compiles stock in/out', () => {
    expect(conditionWhere({ field: 'stock', op: 'in_stock' })).toEqual({ lots: { some: { status: 'LIVE', qtyOnHand: { gt: 0 } } } });
    expect(conditionWhere({ field: 'stock', op: 'out_of_stock' })).toEqual({ NOT: { lots: { some: { status: 'LIVE', qtyOnHand: { gt: 0 } } } } });
  });

  it('drops incomplete conditions (empty value / missing between bound)', () => {
    expect(conditionWhere({ field: 'category', op: 'is', value: '' })).toBeNull();
    expect(conditionWhere({ field: 'price', op: 'between', value: 100 })).toBeNull();
  });

  it('combines with AND for match ALL and OR for match ANY; single condition unwrapped', () => {
    const conds: RuleConfig['conditions'] = [
      { field: 'category', op: 'is', value: 'c1' },
      { field: 'brand', op: 'is', value: 'b1' },
    ];
    expect(buildRuleWhere({ match: 'ALL', conditions: conds })).toEqual({ AND: [{ categories: { some: { id: 'c1' } } }, { brandId: 'b1' }] });
    expect(buildRuleWhere({ match: 'ANY', conditions: conds })).toEqual({ OR: [{ categories: { some: { id: 'c1' } } }, { brandId: 'b1' }] });
    expect(buildRuleWhere({ match: 'ALL', conditions: [conds[0]] })).toEqual({ categories: { some: { id: 'c1' } } });
    expect(buildRuleWhere({ match: 'ALL', conditions: [] })).toEqual({}); // empty = match all
  });

  it('ruleOrderBy maps sort → Prisma orderBy (default featured = ratingCount)', () => {
    expect(ruleOrderBy('bestselling')).toEqual({ orderItems: { _count: 'desc' } });
    expect(ruleOrderBy('newest')).toEqual({ createdAt: 'desc' });
    expect(ruleOrderBy('price_asc')).toEqual({ basePricePiastres: 'asc' });
    expect(ruleOrderBy(undefined)).toEqual({ ratingCount: 'desc' });
    expect(ruleOrderBy('featured')).toEqual({ ratingCount: 'desc' });
  });

  it('parseRule keeps a valid sort and drops an invalid one', () => {
    expect(parseRule({ conditions: [], sort: 'newest' }).sort).toBe('newest');
    expect(parseRule({ conditions: [], sort: 'bogus' }).sort).toBeUndefined();
  });

  it('parseRule coerces junk into a safe config', () => {
    const r = parseRule({
      match: 'ANY',
      conditions: [
        { field: 'category', op: 'is', value: 'c1' },
        { field: 'nonsense', op: 'is', value: 'x' },     // bad field → dropped
        { field: 'brand', op: 'weird', value: 'b1' },    // bad op → dropped
        { field: 'attribute', op: 'is', value: '' },     // empty value → dropped
        { field: 'price', op: 'between', value: '10', value2: '20' }, // strings coerced
        { field: 'stock', op: 'in_stock' },
      ],
    });
    expect(r.match).toBe('ANY');
    expect(r.conditions).toEqual([
      { field: 'category', op: 'is', value: 'c1' },
      { field: 'price', op: 'between', value: 10, value2: 20 },
      { field: 'stock', op: 'in_stock' },
    ]);
    // garbage input → empty ALL rule
    expect(parseRule(null)).toEqual({ match: 'ALL', conditions: [] });
    expect(parseRule('nope')).toEqual({ match: 'ALL', conditions: [] });
  });
});
