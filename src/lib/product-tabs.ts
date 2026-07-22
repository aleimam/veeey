/**
 * Tab metadata for the admin product edit page (owner-approved 7-tab layout,
 * 2026-07-22 — do not redesign). Shared by the server page (initial tab from
 * `?tab=`) and the client ProductForm (tab strip); lives outside the client
 * module so server code can read the ids as plain values.
 */
export const PRODUCT_TABS = [
  { id: 'details', en: 'Details', ar: 'التفاصيل' },
  { id: 'arabic', en: 'Arabic', ar: 'العربية' },
  { id: 'media', en: 'Media', ar: 'الوسائط' },
  { id: 'organization', en: 'Organization', ar: 'التنظيم' },
  { id: 'selling', en: 'Selling', ar: 'البيع' },
  { id: 'stock', en: 'Stock', ar: 'المخزون' },
  { id: 'seo', en: 'SEO', ar: 'SEO' },
] as const;

export type ProductTabId = (typeof PRODUCT_TABS)[number]['id'];

export const isProductTab = (v: string | undefined): v is ProductTabId =>
  PRODUCT_TABS.some((t) => t.id === v);
