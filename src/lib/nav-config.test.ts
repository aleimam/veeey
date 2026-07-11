import { describe, it, expect } from 'vitest';
import { normalizeNav, defaultNav, navFontResolve } from './nav-config';

describe('normalizeNav', () => {
  it('returns the shipped default when given null/garbage', () => {
    expect(normalizeNav(null).items.length).toBe(defaultNav().items.length);
    expect(normalizeNav('nope').items[0].labelEn).toBe('Shop by Goal');
    expect(normalizeNav(42).promo.enabled).toBe(false); // V4 E23: no default free-delivery-threshold promo
  });

  it('coerces types, fills AR from EN, clamps sizes, defaults missing fields', () => {
    const cfg = normalizeNav({
      baseSizePx: 999,
      items: [{ labelEn: 'Deals', href: '/x', sizePx: 5, bold: 'yes' }],
      promo: { enabled: false },
    });
    expect(cfg.baseSizePx).toBe(40); // clamped to max
    expect(cfg.items).toHaveLength(1);
    expect(cfg.items[0].labelAr).toBe('Deals'); // AR falls back to EN
    expect(cfg.items[0].sizePx).toBe(10); // clamped to min
    expect(cfg.items[0].bold).toBe(true); // non-bool → default
    expect(cfg.items[0].id).toBeTruthy(); // id generated
    expect(cfg.promo.enabled).toBe(false);
    expect(cfg.promo.color).toBe('var(--gold)');
  });

  it('drops items with no label and keeps mega columns/links', () => {
    const cfg = normalizeNav({
      items: [
        { labelEn: '' },
        { labelEn: 'Shop', mega: { columns: [{ headingEn: 'A', links: [{ labelEn: 'L', href: '/l' }] }] } },
      ],
    });
    expect(cfg.items).toHaveLength(1);
    expect(cfg.items[0].mega?.columns[0].links[0].href).toBe('/l');
    expect(cfg.items[0].mega?.columns[0].links[0].id).toBeTruthy();
  });

  it('a normalized default round-trips unchanged', () => {
    const once = normalizeNav(defaultNav());
    const twice = normalizeNav(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});

describe('navFontResolve', () => {
  it('empty → inherit (no css, no google load)', () => {
    expect(navFontResolve('')).toEqual({ css: null, googleFamily: null });
  });
  it('preset / literal stacks are applied verbatim, never fetched', () => {
    expect(navFontResolve('var(--font-display)')).toEqual({ css: 'var(--font-display)', googleFamily: null });
    expect(navFontResolve('system-ui, sans-serif').googleFamily).toBeNull();
    expect(navFontResolve('Georgia, serif').googleFamily).toBeNull();
  });
  it('a bare family name is quoted; only non-local ones are requested from Google', () => {
    expect(navFontResolve('Poppins')).toEqual({ css: "'Poppins', sans-serif", googleFamily: null }); // local → applied, not fetched
    expect(navFontResolve('Lobster')).toEqual({ css: "'Lobster', sans-serif", googleFamily: 'Lobster' });
  });
});
