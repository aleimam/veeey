import { describe, it, expect } from 'vitest';
import { isAdminPath } from './admin-path';

// V6 audit S15: this one predicate decides whether marketing tags load and
// whether analytics events fire. Both URL shapes in play must be covered —
// the raw browser path is locale-prefixed, next-intl's is stripped.
describe('isAdminPath', () => {
  it('matches locale-prefixed admin paths (the raw browser URL)', () => {
    expect(isAdminPath('/en/admin')).toBe(true);
    expect(isAdminPath('/en/admin/orders')).toBe(true);
    expect(isAdminPath('/ar/admin/analytics/sales')).toBe(true);
  });

  it('matches locale-stripped admin paths (next-intl usePathname)', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/products')).toBe(true);
  });

  it('does NOT match storefront routes', () => {
    expect(isAdminPath('/en')).toBe(false);
    expect(isAdminPath('/en/category/vitamins')).toBe(false);
    expect(isAdminPath('/ar/product/hypergh-14x')).toBe(false);
    expect(isAdminPath('/en/checkout')).toBe(false);
    expect(isAdminPath('/')).toBe(false);
  });

  it('does NOT match "admin" appearing deeper than the route segment', () => {
    // e.g. a product slug mentioning the word.
    expect(isAdminPath('/en/product/admin-formula')).toBe(false);
    expect(isAdminPath('/en/search?q=admin')).toBe(false);
  });
});
