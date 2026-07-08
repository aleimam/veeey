import { describe, it, expect } from 'vitest';
import { buildRestructurePlan, flattenTree, normName, type ExistingCat } from './taxonomy-restructure';

const cat = (o: Partial<ExistingCat> & { id: string; nameEn: string; slug: string }): ExistingCat => ({
  nameAr: null, parentId: null, archived: false, products: 0, children: 0, ...o,
});

describe('taxonomy restructure planner', () => {
  it('flattens the target tree with parents, children and nested children', () => {
    const nodes = flattenTree();
    const keys = nodes.map((n) => n.key);
    expect(keys).toContain('vitamins-supplements');
    expect(keys).toContain('prostate'); // Men's Health nested child
    expect(nodes.find((n) => n.key === 'prostate')?.parentKey).toBe('mens');
    expect(nodes.find((n) => n.key === 'mens')?.parentKey).toBe('wellness-goals');
    // The two "Treatments" nodes must not collide on slug.
    expect(nodes.find((n) => n.key === 'skin-treatments')?.finalSlug).toBe('skin-treatments');
    expect(nodes.find((n) => n.key === 'hair-treatments')?.finalSlug).toBe('hair-treatments');
  });

  it('assigns alias matches as the primary record and renames them', () => {
    const plan = buildRestructurePlan([cat({ id: 'c1', nameEn: 'Immunity', slug: 'immunity', products: 40 })]);
    const a = plan.assign.find((x) => x.nodeKey === 'immune');
    expect(a?.id).toBe('c1');
    expect(a?.rename).toBe(true);
    expect(a?.reslug).toBe(true);
    expect(plan.redirects.some((r) => r.from.includes('immunity') && r.to.includes('immune-support'))).toBe(true);
    // Everything else gets created.
    expect(plan.create.some((c) => c.nodeKey === 'vitamins')).toBe(true);
  });

  it('merges duplicates into the primary, keeping Arabic labels as nameAr', () => {
    const plan = buildRestructurePlan([
      cat({ id: 'en1', nameEn: 'Vitamins', slug: 'vitamins', products: 100 }),
      cat({ id: 'ar1', nameEn: 'فيتامينات', slug: 'ar-vitamins', products: 5 }),
    ]);
    expect(plan.assign.find((a) => a.nodeKey === 'vitamins')?.id).toBe('en1'); // higher product count wins
    const m = plan.merge.find((x) => x.fromId === 'ar1');
    expect(m?.intoKey).toBe('vitamins');
    expect(m?.keepAsNameAr).toBe(true);
  });

  it('fixes the doc-listed wrong slugs via assignment (babies-kids, eye-vision) and adoption (pain-releif)', () => {
    const plan = buildRestructurePlan([
      cat({ id: 'k1', nameEn: "Children's Health", slug: 'babies-kids', products: 12 }),
      cat({ id: 'e1', nameEn: 'Eye Health', slug: 'eye-vision', products: 3 }),
      cat({ id: 'p1', nameEn: 'Pain & Relief Supplements', slug: 'pain-releif', products: 8 }),
    ]);
    expect(plan.assign.find((a) => a.id === 'k1')?.reslug).toBe(true);
    expect(plan.redirects.some((r) => r.from.includes('babies-kids') && r.to.includes('childrens-health'))).toBe(true);
    expect(plan.assign.find((a) => a.id === 'e1')?.reslug).toBe(true);
    const ad = plan.adopt.find((x) => x.id === 'p1');
    expect(ad?.underKey).toBe('wellness-goals');
    expect(ad?.fixSlug).toBe('pain-relief-supplements');
  });

  it('merges Fertility Supplements into Women\'s Health per the doc', () => {
    const plan = buildRestructurePlan([
      cat({ id: 'w1', nameEn: "Women's Health", slug: 'womens-health', products: 30 }),
      cat({ id: 'f1', nameEn: 'Fertility Supplements', slug: 'productivity-fertility', products: 7 }),
    ]);
    expect(plan.merge.find((m) => m.fromId === 'f1')?.intoKey).toBe('womens');
  });

  it('reports unknown categories as unmatched instead of guessing', () => {
    const plan = buildRestructurePlan([cat({ id: 'x1', nameEn: 'Mystery Box', slug: 'mystery', products: 2 })]);
    expect(plan.unmatched).toHaveLength(1);
    expect(plan.unmatched[0].id).toBe('x1');
    expect(plan.merge).toHaveLength(0);
    expect(plan.adopt).toHaveLength(0);
  });

  it('normName unifies & / Arabic forms for matching', () => {
    expect(normName('Bones & Joints')).toBe(normName('bones and joints'));
    expect(normName('أعشاب')).toBe(normName('اعشاب'));
  });
});
