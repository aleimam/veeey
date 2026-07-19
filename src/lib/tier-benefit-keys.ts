/**
 * SYSTEM tier benefits — the code-enforced list (owner 2026-07-19). Pure module
 * (no DB/auth imports) so it's unit-testable; the service + enforcement sites
 * import from here. Admins toggle tiers per benefit at /admin/tier-benefits but
 * cannot add/remove SYSTEM entries — those require code (this list).
 *
 * `grantAll` = seeded granted-to-every-tier on first creation, so shipping the
 * feature changes nothing until an admin unticks a tier:
 *  - access gates (specialOrder, preOrder, discreetShipping) → grantAll (open today)
 *  - fee waivers (freeShipping, freeUltraFast) → not granted anywhere until toggled
 */
export const SYSTEM_BENEFITS = [
  { key: 'freeShipping', nameEn: 'Free Shipping on all orders', nameAr: 'شحن مجاني على كل الطلبات', grantAll: false },
  { key: 'freeUltraFast', nameEn: 'Free UltraFast Shipping', nameAr: 'شحن ألترا فاست مجاني', grantAll: false },
  { key: 'specialOrder', nameEn: 'Special Order', nameAr: 'الطلب الخاص', grantAll: true },
  { key: 'preOrder', nameEn: 'Pre Order', nameAr: 'الطلب المسبق', grantAll: true },
  { key: 'discreetShipping', nameEn: 'Discrete Shipping Option', nameAr: 'خيار الشحن السري', grantAll: true },
] as const;

export type SystemBenefitKey = (typeof SYSTEM_BENEFITS)[number]['key'];
