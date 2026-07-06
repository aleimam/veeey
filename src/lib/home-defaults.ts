import type { BuiltinType } from './home-layout';

/**
 * Editable content for the built-in homepage sections. The DEFAULTS exactly
 * reproduce the original hard-coded copy, so a section renders identically until
 * the owner overrides a field in the builder. FIELDS drives the generic editor.
 * Bilingual values are stored as `<key>En` / `<key>Ar`; lists are arrays of item
 * objects (item bilingual subfields use the same En/Ar suffix). Decorative
 * icons/illustrations travel inside list items so they survive an edit.
 */

export const BUILTIN_DEFAULTS: Record<BuiltinType, Record<string, unknown>> = {
  hero: {
    slides: [
      { eyebrowEn: 'You Deserve More', eyebrowAr: 'تستحق المزيد', titleEn: 'Premium wellness,\nimported with care.', titleAr: 'صحة فاخرة،\nمستوردة بعناية.', bodyEn: 'Authentic supplements and devices from the USA, UK and EU — every lot dated, every promise kept.', bodyAr: 'مكمّلات وأجهزة أصلية من أمريكا وبريطانيا وأوروبا — كل تشغيلة مؤرّخة، وكل وعد محفوظ.', ctaEn: 'Shop best sellers', ctaAr: 'تسوّق الأكثر مبيعًا', href: '/products', image: '' },
      { eyebrowEn: 'Veeey Refill', eyebrowAr: 'فيي ريفيل', titleEn: 'Never run out.\nSave 15% on every refill.', titleAr: 'لا تنفد أبدًا.\nوفّر ١٥٪ على كل ريفيل.', bodyEn: 'Set your supplements on a schedule and we deliver on time, every time — pause or skip anytime.', bodyAr: 'اضبط مكمّلاتك على جدول ونوصلها في موعدها دائمًا — أوقف أو تخطَّ في أي وقت.', ctaEn: 'Start a Refill plan', ctaAr: 'ابدأ خطة ريفيل', href: '/refill', image: '' },
      { eyebrowEn: 'Expiry transparency', eyebrowAr: 'شفافية الصلاحية', titleEn: 'Choose your expiry,\nchoose your price.', titleAr: 'اختر الصلاحية،\nاختر السعر.', bodyEn: 'Same genuine product, different lots. Near-dated stock costs less — you save, nothing goes to waste.', bodyAr: 'نفس المنتج الأصلي، تشغيلات مختلفة. الأقرب انتهاءً أرخص — توفّر دون هدر.', ctaEn: 'Shop expiry deals', ctaAr: 'تسوّق عروض الصلاحية', href: '/products?offers=1', image: '' },
    ],
  },
  'greet-strip': {
    greetTitleEn: 'Hey, friend!', greetTitleAr: 'أهلاً بك!',
    greetSubEn: 'Sign in for member pricing', greetSubAr: 'سجّل الدخول لأسعار الأعضاء',
    cards: [
      { icon: 'piggy-bank', textEn: 'Save 15% on your first Refill', textAr: 'وفّر ١٥٪ على أول ريفيل', linkEn: 'Set up Veeey Refill', linkAr: 'فعّل فيي ريفيل', href: '/refill' },
      { icon: 'stethoscope', textEn: 'Free chat with a Veeey pharmacist', textAr: 'استشارة مجانية مع صيدلي فيي', linkEn: 'Talk to an expert', linkAr: 'تحدّث مع خبير', href: '/p/contact' },
      { icon: 'gift', textEn: 'Earn points on every order', textAr: 'اكسب نقاطًا مع كل طلب', linkEn: 'See loyalty tiers', linkAr: 'شاهد مستويات الولاء', href: '/p/loyalty-rewards' },
    ],
  },
  'trust-row': {
    cards: [
      { icon: 'stethoscope', titleEn: '24/7 pharmacist help', titleAr: 'مساعدة صيدلي ٢٤/٧', textEn: 'Chat with a licensed Veeey pharmacist any time.', textAr: 'دردش مع صيدلي فيي مرخّص في أي وقت.', href: '/p/contact' },
      { icon: 'shield-check', titleEn: 'Genuine, guaranteed', titleAr: 'أصلي ومضمون', textEn: 'Authentic imports from the USA, UK & EU — every lot dated.', textAr: 'واردات أصلية من أمريكا وبريطانيا وأوروبا — كل تشغيلة مؤرّخة.', href: '/p/authenticity-guarantee' },
      { icon: 'truck', titleEn: 'UltraFast delivery', titleAr: 'توصيل فائق السرعة', textEn: '3–6h in Greater Cairo, fast & free nationwide.', textAr: '٣–٦ ساعات في القاهرة الكبرى، سريع ومجاني للجمهورية.', href: '/p/shipping-delivery' },
      { icon: 'repeat', titleEn: 'Veeey Refill', titleAr: 'فيي ريفيل', textEn: 'Never run out — scheduled refills, pause anytime.', textAr: 'لا تنفد أبدًا — إعادة تعبئة مجدولة، أوقفها متى شئت.', href: '/refill' },
    ],
  },
  goals: {
    titleEn: "What's your wellness goal today?", titleAr: 'ما هدفك الصحي اليوم؟',
    items: [
      { illo: 'shield', labelEn: 'Immunity', labelAr: 'المناعة', href: '/products' },
      { illo: 'bolt', labelEn: 'Energy', labelAr: 'الطاقة', href: '/products' },
      { illo: 'moon', labelEn: 'Sleep', labelAr: 'النوم', href: '/products' },
      { illo: 'heart', labelEn: 'Heart', labelAr: 'القلب', href: '/products' },
      { illo: 'leaf', labelEn: 'Gut Health', labelAr: 'صحة الأمعاء', href: '/products' },
      { illo: 'sparkle', labelEn: 'Beauty', labelAr: 'الجمال', href: '/products' },
      { illo: 'shield-plus', labelEn: "Men's", labelAr: 'الرجال', href: '/products' },
      { illo: 'device', labelEn: 'Devices', labelAr: 'الأجهزة', href: '/products?kind=DEVICE' },
    ],
  },
  membership: {
    headingEn: 'Free delivery & 5% rewards on everything', headingAr: 'توصيل مجاني و٥٪ مكافآت على كل شيء',
    textEn: 'Join Veeey Select — concierge service, early access and luminous gold perks.', textAr: 'انضم إلى فيي سيلكت — خدمة كونسيرج ووصول مبكر ومزايا ذهبية.',
    ctaEn: 'Start free trial', ctaAr: 'ابدأ تجربة مجانية', href: '/select',
  },
  deals: {
    eyebrowEn: 'Limited time', eyebrowAr: 'لفترة محدودة', titleEn: "Today's expiry deals", titleAr: 'عروض الصلاحية اليوم', actionHref: '/products?offers=1',
    promoTitleEn: 'Save up to 30% on near-dated lots', promoTitleAr: 'وفّر حتى ٣٠٪ على التشغيلات القريبة',
    promoTextEn: 'Same genuine product. You save, nothing goes to waste.', promoTextAr: 'نفس المنتج الأصلي. توفّر دون هدر.',
    image: '/lifestyle/kitchen-wellness.jpg',
  },
  categories: {
    titleEn: 'Explore popular categories', titleAr: 'استكشف الفئات الشائعة',
    items: [
      { illo: 'bottle', labelEn: 'Capsules & Tablets', labelAr: 'كبسولات وأقراص', href: '/products' },
      { illo: 'tub', labelEn: 'Powders & Greens', labelAr: 'بودرة وخضراوات', href: '/products' },
      { illo: 'softgel', labelEn: 'Softgels & Oils', labelAr: 'سوفت‑جيل وزيوت', href: '/products' },
      { illo: 'dropper', labelEn: 'Liquids & Drops', labelAr: 'سوائل ونقط', href: '/products' },
      { illo: 'device', labelEn: 'Health Devices', labelAr: 'أجهزة صحية', href: '/products' },
      { illo: 'tag', labelEn: "Today's Deals", labelAr: 'عروض اليوم', href: '/products?offers=1' },
    ],
  },
  'feature-banner': {
    eyebrowEn: 'Subscribe & save', eyebrowAr: 'اشترك ووفّر',
    headingEn: '15% off your first Refill order', headingAr: 'خصم ١٥٪ على أول طلب ريفيل',
    textEn: 'Put your essentials on a schedule and our pharmacists keep them stocked — genuine, dated, and delivered before you run out. Pause, skip or cancel anytime.', textAr: 'ضع أساسياتك على جدول وسيبقيها صيادلتنا متوفرة — أصلية ومؤرّخة وتصلك قبل أن تنفد. أوقف أو تخطَّ أو ألغِ في أي وقت.',
    ctaEn: 'How Refill works', ctaAr: 'كيف يعمل ريفيل', href: '/refill', image: '/lifestyle/kitchen-wellness.jpg',
  },
  'special-order': {
    eyebrowEn: 'Special Order', eyebrowAr: 'طلب خاص', headingEn: "Can't find it? We'll bring it.", headingAr: 'لا تجده؟ سنحضره لك.',
    textEn: 'Request any supplement or health device from the USA, UK or EU. We will source it and fly it to Egypt.', textAr: 'اطلب أي مكمّل أو جهاز صحي من أمريكا أو بريطانيا أو أوروبا. سنوفّره ونشحنه لمصر.',
    ctaEn: 'Start a special order', ctaAr: 'ابدأ طلبًا خاصًا', href: '/special-order',
    steps: [
      { icon: 'search', labelEn: 'Tell us the product', labelAr: 'أخبرنا بالمنتج' },
      { icon: 'credit-card', labelEn: 'Reserve with 25% deposit', labelAr: 'احجز بعربون ٢٥٪' },
      { icon: 'globe', labelEn: 'We buy & fly it to Egypt', labelAr: 'نشتريه ونشحنه لمصر', note: '~20 days' },
      { icon: 'badge-check', labelEn: 'Late? Automatic compensation', labelAr: 'تأخّر؟ تعويض تلقائي' },
    ],
  },
  'best-sellers': {
    eyebrowEn: 'Loved by our A+++ members', eyebrowAr: 'محبوب من أعضائنا', titleEn: 'Best sellers', titleAr: 'الأكثر مبيعًا', actionHref: '/products',
  },
  'learn-blog': {
    eyebrowEn: 'Health, explained', eyebrowAr: 'الصحة ببساطة',
    titleEn: 'From Veeey Learn & Blog', titleAr: 'من فيي تعلّم والمدونة',
    actionHref: '/learn',
  },
  brands: {
    headingEn: 'Trusted imported brands, sourced authentically', headingAr: 'علامات مستوردة موثوقة، بمصادر أصلية',
    items: [
      { name: 'Vital Nutrients' }, { name: 'Sports Research' }, { name: 'Terra Origin' }, { name: 'Tru Niagen' },
      { name: 'Dr. Berg' }, { name: 'Designs for Health' }, { name: 'Omron' }, { name: 'Nutravita' },
    ],
  },
};

/** Merge stored overrides over the defaults (shallow — a provided list replaces the default list). */
export function builtinContent(type: BuiltinType, props: Record<string, unknown> | undefined): Record<string, unknown> {
  return { ...BUILTIN_DEFAULTS[type], ...(props ?? {}) };
}

// ---- Editor descriptors ----------------------------------------------------
export type ItemFieldDesc = { key: string; kind: 'text' | 'plain' | 'image'; en: string; ar: string };
export type FieldDesc =
  | { key: string; kind: 'text' | 'plain' | 'image'; en: string; ar: string }
  | { key: string; kind: 'list'; en: string; ar: string; item: ItemFieldDesc[] };

const T = (key: string, en: string, ar: string): FieldDesc => ({ key, kind: 'text', en, ar });
const P = (key: string, en: string, ar: string): FieldDesc => ({ key, kind: 'plain', en, ar });
const IMG = (key: string, en: string, ar: string): FieldDesc => ({ key, kind: 'image', en, ar });

export const BUILTIN_FIELDS: Record<BuiltinType, FieldDesc[]> = {
  hero: [
    { key: 'slides', kind: 'list', en: 'Slides', ar: 'الشرائح', item: [
      { key: 'eyebrow', kind: 'text', en: 'Eyebrow', ar: 'تمهيد' },
      { key: 'title', kind: 'text', en: 'Title', ar: 'العنوان' },
      { key: 'body', kind: 'text', en: 'Body', ar: 'النص' },
      { key: 'cta', kind: 'text', en: 'Button', ar: 'الزر' },
      { key: 'href', kind: 'plain', en: 'Link', ar: 'الرابط' },
      { key: 'image', kind: 'image', en: 'Image (optional)', ar: 'صورة (اختياري)' },
    ] },
  ],
  'greet-strip': [
    T('greetTitle', 'Greeting title', 'عنوان الترحيب'), T('greetSub', 'Greeting subtitle', 'العنوان الفرعي'),
    { key: 'cards', kind: 'list', en: 'Cards', ar: 'البطاقات', item: [
      { key: 'text', kind: 'text', en: 'Text', ar: 'النص' },
      { key: 'link', kind: 'text', en: 'Link label', ar: 'نص الرابط' },
      { key: 'href', kind: 'plain', en: 'Link', ar: 'الرابط' },
    ] },
  ],
  'trust-row': [
    { key: 'cards', kind: 'list', en: 'Cards', ar: 'البطاقات', item: [
      { key: 'title', kind: 'text', en: 'Title', ar: 'العنوان' },
      { key: 'text', kind: 'text', en: 'Text', ar: 'النص' },
      { key: 'href', kind: 'plain', en: 'Link', ar: 'الرابط' },
    ] },
  ],
  goals: [
    T('title', 'Title', 'العنوان'),
    { key: 'items', kind: 'list', en: 'Goals', ar: 'الأهداف', item: [
      { key: 'label', kind: 'text', en: 'Label', ar: 'التسمية' }, { key: 'href', kind: 'plain', en: 'Link', ar: 'الرابط' },
    ] },
  ],
  membership: [T('heading', 'Heading', 'العنوان'), T('text', 'Text', 'النص'), T('cta', 'Button', 'الزر'), P('href', 'Link', 'الرابط')],
  deals: [
    T('eyebrow', 'Eyebrow', 'تمهيد'), T('title', 'Title', 'العنوان'), P('actionHref', '"Shop all" link', 'رابط "الكل"'),
    T('promoTitle', 'Promo title', 'عنوان العرض'), T('promoText', 'Promo text', 'نص العرض'), IMG('image', 'Promo image', 'صورة العرض'),
  ],
  categories: [
    T('title', 'Title', 'العنوان'),
    { key: 'items', kind: 'list', en: 'Categories', ar: 'الفئات', item: [
      { key: 'label', kind: 'text', en: 'Label', ar: 'التسمية' }, { key: 'href', kind: 'plain', en: 'Link', ar: 'الرابط' },
    ] },
  ],
  'feature-banner': [T('eyebrow', 'Eyebrow', 'تمهيد'), T('heading', 'Heading', 'العنوان'), T('text', 'Text', 'النص'), T('cta', 'Button', 'الزر'), P('href', 'Link', 'الرابط'), IMG('image', 'Image', 'الصورة')],
  'special-order': [
    T('eyebrow', 'Eyebrow', 'تمهيد'), T('heading', 'Heading', 'العنوان'), T('text', 'Text', 'النص'), T('cta', 'Button', 'الزر'), P('href', 'Link', 'الرابط'),
    { key: 'steps', kind: 'list', en: 'Steps', ar: 'الخطوات', item: [{ key: 'label', kind: 'text', en: 'Step', ar: 'الخطوة' }] },
  ],
  'best-sellers': [T('eyebrow', 'Eyebrow', 'تمهيد'), T('title', 'Title', 'العنوان'), P('actionHref', '"View all" link', 'رابط "عرض الكل"')],
  'learn-blog': [T('eyebrow', 'Eyebrow', 'تمهيد'), T('title', 'Title', 'العنوان'), P('actionHref', '"View all" link', 'رابط "عرض الكل"')],
  brands: [
    T('heading', 'Heading', 'العنوان'),
    { key: 'items', kind: 'list', en: 'Brands', ar: 'العلامات', item: [
      { key: 'name', kind: 'plain', en: 'Brand name', ar: 'اسم العلامة' },
      { key: 'href', kind: 'plain', en: 'Link (e.g. /brands/<slug>)', ar: 'الرابط (مثل ‎/brands/<slug>)' },
    ] },
  ],
};
