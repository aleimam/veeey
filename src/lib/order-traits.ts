/**
 * Shared labels for the two customer-trait fields that live on the order but
 * mirror onto the customer (owner batch 2026-07-23):
 *  - Shopping Style  → the `CustomerOrderType` enum (how the shopper decides).
 *  - Products type   → the `OrderProductType` enum (what kind of products).
 * The enum VALUES are unchanged; only the display labels were re-spec'd, so the
 * order edit page, the customer edit page and the customer details page all read
 * from here and stay in sync. Order Source keeps using CHANNELS (unchanged).
 */

export type ShoppingStyle = 'DISCOUNT_CHASER' | 'DOCTOR_RECOMMENDED' | 'SALES_ADVICE' | 'SELF_ORDERING';
export type ProductsType = 'MISCELLANEOUS' | 'MALE_SUPPORT' | 'PREMIUM' | 'NEW' | 'TREND';

export const SHOPPING_STYLES: { value: ShoppingStyle; en: string; ar: string }[] = [
  { value: 'DISCOUNT_CHASER', en: 'Discount Chaser', ar: 'باحث عن الخصومات' },
  { value: 'DOCTOR_RECOMMENDED', en: 'Doctor Advise', ar: 'بنصيحة الطبيب' },
  { value: 'SALES_ADVICE', en: 'Pharmacist Advise', ar: 'بنصيحة الصيدلي' },
  { value: 'SELF_ORDERING', en: 'Self Advise', ar: 'قرار ذاتي' },
];

export const PRODUCTS_TYPES: { value: ProductsType; en: string; ar: string }[] = [
  { value: 'PREMIUM', en: 'Premium', ar: 'بريميوم' },
  { value: 'NEW', en: 'New', ar: 'جديد' },
  { value: 'TREND', en: 'Trend', ar: 'رائج' },
  { value: 'MALE_SUPPORT', en: 'Male', ar: 'صحة الرجل' },
  { value: 'MISCELLANEOUS', en: 'Misc', ar: 'متنوّع' },
];

export const shoppingStyleLabel = (v: string | null | undefined, locale: string): string | null => {
  const o = SHOPPING_STYLES.find((x) => x.value === v);
  return o ? (locale === 'ar' ? o.ar : o.en) : null;
};
export const productsTypeLabel = (v: string | null | undefined, locale: string): string | null => {
  const o = PRODUCTS_TYPES.find((x) => x.value === v);
  return o ? (locale === 'ar' ? o.ar : o.en) : null;
};
