/**
 * Feature flags (admin on/off switches for customer-facing features). Pure
 * registry + helpers — no DB/auth imports, so it's safe to import anywhere and
 * is unit-tested. The service layer (feature-service.ts) reads/writes the
 * backing Settings; pages/nav/footer/home gate on it.
 *
 * OFF means "hide everywhere + block the page": entry points (header nav, footer,
 * home, PDP/login controls) disappear, and the owned routes redirect home.
 * Everything defaults ON, so nothing changes until an admin flips a switch.
 */

export type FeatureId =
  | 'refill'
  | 'select'
  | 'specialOrders'
  | 'blog'
  | 'quizzes'
  | 'wishlist'
  | 'compare'
  | 'loyalty'
  | 'reviews'
  | 'qa'
  | 'socialLogin'
  | 'buyAgain'
  | 'giftWithPurchase'
  | 'stockAlerts'
  | 'preorder';

export type FeatureDef = {
  id: FeatureId;
  label: [string, string]; // [en, ar]
  description: [string, string];
  group: [string, string];
  default: boolean;
  /** Route path prefixes this feature owns (locale-stripped). Used to guard the
   *  routes and to hide header/footer/home links that point at them. */
  paths: string[];
};

export const FEATURES: FeatureDef[] = [
  { id: 'refill', label: ['Veeey Refill', 'فيي ريفيل'], description: ['Subscribe & save auto-reorder — the /refill page, its buy-box frequency picker, and menu links.', 'الاشتراك والتوفير بإعادة الطلب التلقائي — صفحة /refill ومحدد التكرار في صندوق الشراء وروابط القوائم.'], group: ['Programs', 'البرامج'], default: true, paths: ['/refill'] },
  { id: 'select', label: ['Veeey Select', 'فيي سيلكت'], description: ['The Veeey Select membership landing page and its menu links.', 'صفحة عضوية فيي سيلكت وروابط قوائمها.'], group: ['Programs', 'البرامج'], default: true, paths: ['/select'] },
  { id: 'specialOrders', label: ['Special orders', 'الطلبات الخاصة'], description: ['Customer requests for products not in the catalog — the /special-order page and its links.', 'طلبات العملاء لمنتجات غير موجودة بالكتالوج — صفحة /special-order وروابطها.'], group: ['Programs', 'البرامج'], default: true, paths: ['/special-order'] },
  { id: 'blog', label: ['Learn & Blog', 'التعلّم والمدوّنة'], description: ['Editorial content — the /learn and /blog pages, the home Learn section, and menu links.', 'المحتوى التحريري — صفحتا /learn و/blog وقسم التعلّم بالصفحة الرئيسية وروابط القوائم.'], group: ['Content', 'المحتوى'], default: true, paths: ['/learn', '/blog'] },
  { id: 'quizzes', label: ['Quizzes & finders', 'الاختبارات والمرشدات'], description: ['Interactive product-finder quizzes — the /play pages and their links.', 'اختبارات إيجاد المنتج التفاعلية — صفحات /play وروابطها.'], group: ['Content', 'المحتوى'], default: true, paths: ['/play'] },
  { id: 'compare', label: ['Product compare', 'مقارنة المنتجات'], description: ['Side-by-side product comparison — the /compare page and its "Compare" controls.', 'مقارنة المنتجات جنبًا إلى جنب — صفحة /compare وأزرار المقارنة.'], group: ['Shopping', 'التسوّق'], default: true, paths: ['/compare'] },
  { id: 'wishlist', label: ['Wishlist', 'قائمة الرغبات'], description: ['Save-for-later lists — the /wishlist page and the heart/save buttons on products.', 'قوائم الحفظ لاحقًا — صفحة /wishlist وأزرار الحفظ على المنتجات.'], group: ['Shopping', 'التسوّق'], default: true, paths: ['/wishlist'] },
  { id: 'preorder', label: ['Pre-order', 'الطلب المسبق'], description: ['Buy out-of-stock products ahead of restock — the pre-order CTA on product pages.', 'شراء المنتجات غير المتوفرة قبل إعادة التخزين — زر الطلب المسبق في صفحات المنتج.'], group: ['Shopping', 'التسوّق'], default: true, paths: [] },
  { id: 'buyAgain', label: ['Buy again / reorder', 'إعادة الشراء'], description: ['One-tap reorder of past purchases in the account area.', 'إعادة طلب المشتريات السابقة بنقرة واحدة في منطقة الحساب.'], group: ['Shopping', 'التسوّق'], default: true, paths: [] },
  { id: 'reviews', label: ['Ratings & reviews', 'التقييمات والمراجعات'], description: ['Star ratings and written reviews on product pages.', 'التقييمات بالنجوم والمراجعات المكتوبة في صفحات المنتج.'], group: ['Social proof', 'الدليل الاجتماعي'], default: true, paths: [] },
  { id: 'qa', label: ['Questions & answers', 'الأسئلة والأجوبة'], description: ['Customer questions and answers on product pages.', 'أسئلة العملاء وأجوبتها في صفحات المنتج.'], group: ['Social proof', 'الدليل الاجتماعي'], default: true, paths: [] },
  { id: 'loyalty', label: ['Loyalty points & tiers', 'نقاط الولاء والمستويات'], description: ['Points earning/redeeming and membership tiers — points UI in account and on products, tier badges.', 'كسب/استبدال النقاط ومستويات العضوية — واجهة النقاط في الحساب وعلى المنتجات وشارات المستوى.'], group: ['Rewards', 'المكافآت'], default: true, paths: [] },
  { id: 'giftWithPurchase', label: ['Gift with purchase', 'هدية مع الشراء'], description: ['Automatic free gifts added to qualifying orders per gift rules.', 'إضافة هدايا مجانية تلقائيًا للطلبات المؤهلة وفق قواعد الهدايا.'], group: ['Rewards', 'المكافآت'], default: true, paths: [] },
  { id: 'stockAlerts', label: ['Back-in-stock & price-drop alerts', 'تنبيهات التوفّر وانخفاض السعر'], description: ['Let shoppers subscribe to restock and price-drop notifications on products.', 'السماح للمتسوّقين بالاشتراك في تنبيهات إعادة التخزين وانخفاض السعر على المنتجات.'], group: ['Rewards', 'المكافآت'], default: true, paths: [] },
  { id: 'socialLogin', label: ['Social login', 'تسجيل الدخول الاجتماعي'], description: ['Google / Facebook / Apple sign-in buttons on the login page (individual providers still need their own credentials).', 'أزرار الدخول عبر جوجل/فيسبوك/آبل في صفحة الدخول (كل مزوّد يحتاج بيانات اعتماده).'], group: ['Accounts', 'الحسابات'], default: true, paths: [] },
];

export const FEATURE_IDS: FeatureId[] = FEATURES.map((f) => f.id);
const FEATURE_DEFAULTS = new Map<FeatureId, boolean>(FEATURES.map((f) => [f.id, f.default]));

/** Setting key that backs a feature flag. */
export const featureSettingKey = (id: FeatureId): string => `feature.${id}`;

/** Interpret a raw setting value: only an explicit "off"/"false"/"0" disables. */
export function isEnabledValue(raw: string | undefined, def: boolean): boolean {
  if (raw == null || raw === '') return def;
  return !['off', 'false', '0', 'no'].includes(raw.trim().toLowerCase());
}

/** Resolve one feature from a `feature.<id>` → value map (missing = default). */
export function featureEnabled(values: Record<string, string>, id: FeatureId): boolean {
  return isEnabledValue(values[featureSettingKey(id)], FEATURE_DEFAULTS.get(id) ?? true);
}

/** Map a locale-stripped path to the feature that owns it (longest-prefix wins). */
export function featureForPath(path: string): FeatureId | null {
  const clean = path.split('?')[0].split('#')[0];
  let best: { id: FeatureId; len: number } | null = null;
  for (const f of FEATURES) {
    for (const p of f.paths) {
      if (clean === p || clean.startsWith(p + '/')) {
        if (!best || p.length > best.len) best = { id: f.id, len: p.length };
      }
    }
  }
  return best?.id ?? null;
}

/** Strip a leading /{locale} segment so hrefs like /en/refill match /refill. */
export function stripLocale(href: string): string {
  return href.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
}

/** Given the enabled-state map, is the feature owning this href disabled? */
export function isHrefDisabled(href: string, states: Record<FeatureId, boolean>): boolean {
  if (!href || href === '#') return false;
  const id = featureForPath(stripLocale(href));
  return id ? states[id] === false : false;
}
