import { describe, it, expect } from 'vitest';
import { normalizeAxes, parseVariantValues, resolveTarget, buildAxisRows, type VariantSibling } from './variant-groups';

const axes = normalizeAxes([
  { nameEn: 'Size', nameAr: 'الحجم' },
  { nameEn: 'Flavor', nameAr: 'النكهة' },
]);

const sib = (id: string, size: string, flavor: string, sort: number, inStock = true): VariantSibling => ({
  id,
  slugEn: `p-${id}`,
  slugAr: null,
  sort,
  inStock,
  values: { size: { en: size, ar: size }, flavor: { en: flavor, ar: flavor } },
});

// 60/120 tablets × Chocolate/Vanilla, but 120-Vanilla does not exist.
const siblings = [sib('a', '60 tablets', 'Chocolate', 0), sib('b', '120 tablets', 'Chocolate', 1), sib('c', '60 tablets', 'Vanilla', 2)];

describe('normalizeAxes', () => {
  it('slugifies keys, fills Arabic fallback, caps at 3, dedupes keys', () => {
    expect(axes).toEqual([
      { key: 'size', nameEn: 'Size', nameAr: 'الحجم' },
      { key: 'flavor', nameEn: 'Flavor', nameAr: 'النكهة' },
    ]);
    const many = normalizeAxes([{ nameEn: 'A' }, { nameEn: 'A' }, { nameEn: 'B' }, { nameEn: 'C' }, { nameEn: 'D' }]);
    expect(many).toHaveLength(3);
    expect(new Set(many.map((a) => a.key)).size).toBe(3);
    expect(normalizeAxes([{ nameEn: 'A' }])[0].nameAr).toBe('A'); // fallback
    expect(normalizeAxes('junk')).toEqual([]);
  });
});

describe('parseVariantValues', () => {
  it('keeps only known axes with non-empty EN, Arabic falls back to EN', () => {
    const v = parseVariantValues({ size: { en: ' 60 tablets ' }, bogus: { en: 'x' }, flavor: { en: '' } }, axes);
    expect(v).toEqual({ size: { en: '60 tablets', ar: '60 tablets' } });
  });
});

describe('resolveTarget', () => {
  it('prefers the sibling matching the other axes, else falls back by sort', () => {
    // From 60-Chocolate, pick size=120 → 120-Chocolate (other axis preserved).
    expect(resolveTarget(siblings, axes, siblings[0], 'size', '120 tablets')?.id).toBe('b');
    // From 60-Vanilla, pick size=120 → no 120-Vanilla → falls back to 120-Chocolate.
    expect(resolveTarget(siblings, axes, siblings[2], 'size', '120 Tablets')?.id).toBe('b'); // case-insensitive
    expect(resolveTarget(siblings, axes, siblings[0], 'flavor', 'Mango')).toBeNull();
  });
});

describe('buildAxisRows', () => {
  it('builds one row per axis with distinct chips and the current flag', () => {
    const rows = buildAxisRows(axes, siblings, 'a');
    expect(rows).toHaveLength(2);
    const size = rows[0];
    expect(size.chips.map((c) => c.labelEn)).toEqual(['60 tablets', '120 tablets']);
    expect(size.chips[0].current).toBe(true);
    expect(size.chips[1].slugEn).toBe('p-b');
    const flavor = rows[1];
    expect(flavor.chips.map((c) => c.labelEn)).toEqual(['Chocolate', 'Vanilla']);
  });

  it('drops axes with fewer than 2 distinct values and handles unknown current', () => {
    const one = [sib('a', '60 tablets', 'Chocolate', 0), sib('b', '120 tablets', 'Chocolate', 1)];
    const rows = buildAxisRows(axes, one, 'a');
    expect(rows).toHaveLength(1); // flavor row dropped (single value)
    expect(rows[0].axis.key).toBe('size');
    expect(buildAxisRows(axes, one, 'zz')).toEqual([]);
  });
});
