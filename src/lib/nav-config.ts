/**
 * Editable primary navigation — the top bar AND the mega-menu dropdowns.
 * Persisted as the JSON Setting `nav.config` (mirrors `home.layout` /
 * `theme.tokens`; no dedicated table). The header renders entirely from this,
 * so admins can change labels, links, icons, colours, font, sizes, order and
 * the mega-menu contents without a deploy. Pure model: types + defaults that
 * reproduce the shipped nav 1:1 + a normalizer. Unit-tested.
 */

export type NavMegaLink = { id: string; labelEn: string; labelAr: string; href: string };
export type NavMegaColumn = { id: string; headingEn: string; headingAr: string; links: NavMegaLink[] };
export type NavMegaPromo = {
  enabled: boolean;
  eyebrowEn: string; eyebrowAr: string;
  titleEn: string; titleAr: string;
  ctaEn: string; ctaAr: string;
  href: string;
};
export type NavMega = { columns: NavMegaColumn[]; promo: NavMegaPromo | null };

export type NavItem = {
  id: string;
  labelEn: string; labelAr: string;
  href: string;
  icon: string; // lucide icon name, or '' for none (shown before the label)
  color: string; // CSS colour (hex or var(--token)); '' = inherit the bar's base colour
  bold: boolean;
  sizePx: number | null; // per-item font-size override; null = use the bar base size
  visible: boolean;
  mega: NavMega | null; // dropdown panel, or null for a plain link
};

export type NavPromo = {
  enabled: boolean;
  textEn: string; textAr: string;
  href: string; // '' = plain text (not a link)
  color: string;
};

export type NavConfig = {
  fontFamily: string; // '' = inherit | 'var(--font-display)' etc. | a Google font family name
  baseSizePx: number;
  baseColor: string; // colour for items with no per-item colour (the bar sits on green → white)
  items: NavItem[];
  promo: NavPromo; // the right-aligned free-delivery line
};

// Fonts already bundled/loaded by the app — never request these from Google.
const LOCAL_FONTS = new Set(['Playfair Display', 'Montserrat', 'GE SS Unique', 'GE Dinar Two', 'Poppins', 'Cairo']);
const GENERIC = /(^var\()|,|(\b(serif|sans-serif|monospace|system-ui|ui-|cursive)\b)/i;

/** Resolve the nav font choice into a CSS value + an optional Google family to load. */
export function navFontResolve(fontFamily: string): { css: string | null; googleFamily: string | null } {
  const v = (fontFamily ?? '').trim();
  if (!v) return { css: null, googleFamily: null };
  if (GENERIC.test(v)) return { css: v, googleFamily: null }; // preset / literal CSS family stack
  const name = v.replace(/['"]/g, '');
  return { css: `'${name}', sans-serif`, googleFamily: LOCAL_FONTS.has(name) ? null : name };
}

// ── Colour presets offered in the editor (the bar sits on the green header) ──
export const NAV_COLORS: { label: string; value: string }[] = [
  { label: 'White', value: '#ffffff' },
  { label: 'Gold', value: 'var(--gold)' },
  { label: 'Lime', value: 'var(--lime)' },
  { label: 'Muted white', value: 'rgba(255,255,255,0.8)' },
];

export const NAV_FONTS: { label: string; value: string }[] = [
  { label: 'Site default', value: '' },
  { label: 'Display (Playfair)', value: 'var(--font-display)' },
  { label: 'Body (Montserrat)', value: 'var(--font-body)' },
  { label: 'System sans', value: 'system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Monospace', value: 'ui-monospace, monospace' },
];

const refillPromo = (): NavMegaPromo => ({
  enabled: true,
  eyebrowEn: 'Veeey Refill', eyebrowAr: 'فيي ريفيل',
  titleEn: 'Subscribe & save 15% on every delivery', titleAr: 'اشترك ووفّر ١٥٪ على كل توصيلة',
  ctaEn: 'Set up a plan', ctaAr: 'ابدأ خطة',
  href: '/refill',
});

const col = (id: string, headingEn: string, headingAr: string, links: [string, string, string][]): NavMegaColumn => ({
  id, headingEn, headingAr,
  links: links.map(([labelEn, labelAr, href], i) => ({ id: `${id}-${i + 1}`, labelEn, labelAr, href })),
});

/** The shipped navigation, verbatim — used until an admin edits it. */
export function defaultNav(): NavConfig {
  return {
    fontFamily: '',
    baseSizePx: 15,
    baseColor: '#ffffff',
    promo: { enabled: true, textEn: 'Free delivery over EGP 1,500', textAr: 'توصيل مجاني لأكثر من ١٥٠٠ ج.م', href: '', color: 'var(--gold)' },
    items: [
      {
        id: 'shop-goal', labelEn: 'Shop by Goal', labelAr: 'تسوّق حسب الهدف', href: '/products', icon: '', color: '', bold: true, sizePx: null, visible: true,
        mega: {
          columns: [
            col('goals-by', 'By goal', 'حسب الهدف', [
              ['Immunity', 'المناعة', '/products'], ['Energy', 'الطاقة', '/products'], ['Sleep', 'النوم', '/products'],
              ['Heart', 'القلب', '/products'], ['Gut Health', 'صحة الأمعاء', '/products'], ['Beauty', 'الجمال', '/products'],
              ["Men's", 'الرجال', '/products'], ['Devices', 'الأجهزة', '/products?kind=DEVICE'],
            ]),
            col('goals-pop', 'Popular', 'الأكثر رواجًا', [
              ['Best sellers', 'الأكثر مبيعًا', '/products'], ['New arrivals', 'وصل حديثًا', '/products'],
              ['Expiry deals', 'عروض قرب الصلاحية', '/products?offers=1'], ['Bundles & stacks', 'الحزم', '/products'],
            ]),
            col('goals-men', "Men's wellness", 'صحة الرجل', [
              ['Performance', 'الأداء', '/products'], ['Prostate', 'البروستاتا', '/products'],
              ['Testosterone', 'التستوستيرون', '/products'], ['Energy', 'الطاقة', '/products'],
            ]),
          ],
          promo: refillPromo(),
        },
      },
      {
        id: 'supplements', labelEn: 'Supplements', labelAr: 'المكمّلات', href: '/products?kind=SUPPLEMENT', icon: '', color: '', bold: true, sizePx: null, visible: true,
        mega: {
          columns: [
            col('supps-form', 'By form', 'حسب الشكل', [
              ['Capsules & Tablets', 'كبسولات وأقراص', '/products'], ['Softgels & Oils', 'سوفت جيل وزيوت', '/products'],
              ['Powders & Greens', 'بودرة وخضراوات', '/products'], ['Liquids & Drops', 'سوائل وقطرات', '/products'],
            ]),
            col('supps-brands', 'Top brands', 'أفضل العلامات', [
              ['Vital Nutrients', 'Vital Nutrients', '/brands'], ['Sports Research', 'Sports Research', '/brands'],
              ['Terra Origin', 'Terra Origin', '/brands'], ['Tru Niagen', 'Tru Niagen', '/brands'], ['Dr. Berg', 'Dr. Berg', '/brands'],
            ]),
            col('supps-dev', 'Health devices', 'الأجهزة الصحية', [
              ['Blood pressure', 'ضغط الدم', '/products?kind=DEVICE'], ['Glucose', 'السكر', '/products?kind=DEVICE'],
              ['Thermometers', 'موازين الحرارة', '/products?kind=DEVICE'], ['Scales', 'موازين', '/products?kind=DEVICE'],
            ]),
          ],
          promo: refillPromo(),
        },
      },
      { id: 'devices', labelEn: 'Devices', labelAr: 'الأجهزة', href: '/products?kind=DEVICE', icon: '', color: '', bold: true, sizePx: null, visible: true, mega: null },
      { id: 'refill', labelEn: 'Veeey Refill', labelAr: 'فيي ريفيل', href: '/refill', icon: '', color: '', bold: true, sizePx: null, visible: true, mega: null },
      { id: 'select', labelEn: 'Veeey Select', labelAr: 'فيي سيلكت', href: '/select', icon: 'crown', color: 'var(--gold)', bold: true, sizePx: null, visible: true, mega: null },
      { id: 'deals', labelEn: "Today's Deals", labelAr: 'عروض اليوم', href: '/products?offers=1', icon: '', color: 'var(--lime)', bold: true, sizePx: null, visible: true, mega: null },
      { id: 'special', labelEn: 'Special Order', labelAr: 'طلب خاص', href: '/special-order', icon: '', color: '', bold: true, sizePx: null, visible: true, mega: null },
      { id: 'learn', labelEn: 'Learn', labelAr: 'تعلّم', href: '/learn', icon: '', color: '', bold: true, sizePx: null, visible: true, mega: null },
      { id: 'blog', labelEn: 'Blog', labelAr: 'المدوّنة', href: '/blog', icon: '', color: '', bold: true, sizePx: null, visible: true, mega: null },
    ],
  };
}

// ── Normalizer — coerce arbitrary stored JSON into a safe, complete NavConfig ──
const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def);
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
const clampSize = (v: unknown, lo: number, hi: number, def: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

let idSeq = 0;
const genId = (prefix: string) => `${prefix}-${++idSeq}`;

function normLink(raw: unknown): NavMegaLink {
  const r = (raw ?? {}) as Record<string, unknown>;
  return { id: str(r.id) || genId('lnk'), labelEn: str(r.labelEn), labelAr: str(r.labelAr) || str(r.labelEn), href: str(r.href, '#') || '#' };
}
function normColumn(raw: unknown): NavMegaColumn {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(r.id) || genId('col'),
    headingEn: str(r.headingEn), headingAr: str(r.headingAr) || str(r.headingEn),
    links: Array.isArray(r.links) ? r.links.map(normLink) : [],
  };
}
function normPromo(raw: unknown): NavMegaPromo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    enabled: bool(r.enabled, true),
    eyebrowEn: str(r.eyebrowEn), eyebrowAr: str(r.eyebrowAr) || str(r.eyebrowEn),
    titleEn: str(r.titleEn), titleAr: str(r.titleAr) || str(r.titleEn),
    ctaEn: str(r.ctaEn), ctaAr: str(r.ctaAr) || str(r.ctaEn),
    href: str(r.href, '#') || '#',
  };
}
function normMega(raw: unknown): NavMega | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return { columns: Array.isArray(r.columns) ? r.columns.map(normColumn) : [], promo: normPromo(r.promo) };
}
function normItem(raw: unknown): NavItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sizeRaw = r.sizePx;
  return {
    id: str(r.id) || genId('item'),
    labelEn: str(r.labelEn), labelAr: str(r.labelAr) || str(r.labelEn),
    href: str(r.href, '#') || '#',
    icon: str(r.icon),
    color: str(r.color),
    bold: bool(r.bold, true),
    sizePx: sizeRaw == null || sizeRaw === '' ? null : clampSize(sizeRaw, 10, 40, 15),
    visible: bool(r.visible, true),
    mega: normMega(r.mega),
  };
}

export function normalizeNav(raw: unknown): NavConfig {
  idSeq = 0;
  if (!raw || typeof raw !== 'object') return defaultNav();
  const r = raw as Record<string, unknown>;
  const items = Array.isArray(r.items) ? r.items.map(normItem).filter((i) => i.labelEn || i.labelAr) : defaultNav().items;
  const p = (r.promo ?? {}) as Record<string, unknown>;
  return {
    fontFamily: str(r.fontFamily),
    baseSizePx: clampSize(r.baseSizePx, 10, 40, 15),
    baseColor: str(r.baseColor, '#ffffff') || '#ffffff',
    items: items.length ? items : defaultNav().items,
    promo: {
      enabled: bool(p.enabled, true),
      textEn: str(p.textEn), textAr: str(p.textAr) || str(p.textEn),
      href: str(p.href),
      color: str(p.color, 'var(--gold)') || 'var(--gold)',
    },
  };
}
