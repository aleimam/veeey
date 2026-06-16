/** The 27 governorates of Egypt (FR-CHK / FR-ACC-03). Stored value = English name;
 *  display is locale-aware. Pure constant — safe in client + server components. */
export type Governorate = { en: string; ar: string };

export const GOVERNORATES: Governorate[] = [
  { en: 'Cairo', ar: 'القاهرة' },
  { en: 'Giza', ar: 'الجيزة' },
  { en: 'Alexandria', ar: 'الإسكندرية' },
  { en: 'Dakahlia', ar: 'الدقهلية' },
  { en: 'Sharqia', ar: 'الشرقية' },
  { en: 'Qalyubia', ar: 'القليوبية' },
  { en: 'Beheira', ar: 'البحيرة' },
  { en: 'Gharbia', ar: 'الغربية' },
  { en: 'Monufia', ar: 'المنوفية' },
  { en: 'Kafr El Sheikh', ar: 'كفر الشيخ' },
  { en: 'Damietta', ar: 'دمياط' },
  { en: 'Port Said', ar: 'بورسعيد' },
  { en: 'Ismailia', ar: 'الإسماعيلية' },
  { en: 'Suez', ar: 'السويس' },
  { en: 'Fayoum', ar: 'الفيوم' },
  { en: 'Beni Suef', ar: 'بني سويف' },
  { en: 'Minya', ar: 'المنيا' },
  { en: 'Assiut', ar: 'أسيوط' },
  { en: 'Sohag', ar: 'سوهاج' },
  { en: 'Qena', ar: 'قنا' },
  { en: 'Luxor', ar: 'الأقصر' },
  { en: 'Aswan', ar: 'أسوان' },
  { en: 'Red Sea', ar: 'البحر الأحمر' },
  { en: 'New Valley', ar: 'الوادي الجديد' },
  { en: 'Matrouh', ar: 'مطروح' },
  { en: 'North Sinai', ar: 'شمال سيناء' },
  { en: 'South Sinai', ar: 'جنوب سيناء' },
];

export function governorateLabel(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const g = GOVERNORATES.find((x) => x.en === value);
  return g ? (locale === 'ar' ? g.ar : g.en) : value;
}
