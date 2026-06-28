import { z } from 'zod';

/**
 * Page-block model (homepage builder, later any page). A layout is an ordered
 * list of blocks; each block is a built-in section (singleton) or an added
 * gadget (repeatable). Pure — no DB/React — so it's unit-testable and shared by
 * the storefront renderer, the admin builder, and the layout service.
 */

// Built-in homepage sections — singletons, toggle + reorder only (content edited elsewhere for now).
export const BUILTIN_TYPES = [
  'hero', 'greet-strip', 'goals', 'membership', 'deals',
  'categories', 'feature-banner', 'special-order', 'best-sellers', 'brands',
] as const;
// Gadgets — repeatable, fully editable, can be added/removed.
export const GADGET_TYPES = ['rich', 'image-banner', 'product-row', 'cta', 'tiles'] as const;

export type BuiltinType = (typeof BUILTIN_TYPES)[number];
export type GadgetType = (typeof GADGET_TYPES)[number];
export type BlockType = BuiltinType | GadgetType;

export type Block = {
  id: string;
  type: BlockType;
  enabled: boolean;
  props?: Record<string, unknown>;
};

const GADGET_SET = new Set<string>(GADGET_TYPES);
export const isGadget = (t: string): t is GadgetType => GADGET_SET.has(t);
const BUILTIN_SET = new Set<string>(BUILTIN_TYPES);
export const isBuiltin = (t: string): t is BuiltinType => BUILTIN_SET.has(t);

/** Bilingual + display labels for every block type (admin builder). */
export const BLOCK_META: Record<BlockType, { en: string; ar: string; gadget: boolean }> = {
  hero: { en: 'Hero carousel', ar: 'سلايدر البطل', gadget: false },
  'greet-strip': { en: 'Greeting strip', ar: 'شريط الترحيب', gadget: false },
  goals: { en: 'Wellness goals', ar: 'الأهداف الصحية', gadget: false },
  membership: { en: 'Membership banner', ar: 'بانر العضوية', gadget: false },
  deals: { en: 'Expiry deals', ar: 'عروض الصلاحية', gadget: false },
  categories: { en: 'Category tiles', ar: 'بطاقات الفئات', gadget: false },
  'feature-banner': { en: 'Refill feature banner', ar: 'بانر ريفيل', gadget: false },
  'special-order': { en: 'Special order', ar: 'الطلب الخاص', gadget: false },
  'best-sellers': { en: 'Best sellers', ar: 'الأكثر مبيعًا', gadget: false },
  brands: { en: 'Brand strip', ar: 'شريط العلامات', gadget: false },
  rich: { en: 'Rich content', ar: 'محتوى منسّق', gadget: true },
  'image-banner': { en: 'Image / banner', ar: 'صورة / بانر', gadget: true },
  'product-row': { en: 'Product row', ar: 'صف منتجات', gadget: true },
  cta: { en: 'Call to action', ar: 'دعوة لإجراء', gadget: true },
  tiles: { en: 'Tiles', ar: 'بطاقات', gadget: true },
};

/** Default props seeded when a gadget is added. */
export function defaultProps(type: GadgetType): Record<string, unknown> {
  switch (type) {
    case 'rich':
      return { htmlEn: '', htmlAr: '', width: 'wide' };
    case 'image-banner':
      return { imageUrl: '', headingEn: '', headingAr: '', textEn: '', textAr: '', ctaLabelEn: '', ctaLabelAr: '', href: '' };
    case 'product-row':
      return { titleEn: 'Featured', titleAr: 'مميّز', source: 'bestsellers', collectionId: '', limit: 5, actionHref: '/products' };
    case 'cta':
      return { headingEn: '', headingAr: '', textEn: '', textAr: '', ctaLabelEn: '', ctaLabelAr: '', href: '', bg: 'green' };
    case 'tiles':
      return { titleEn: '', titleAr: '', tiles: [] };
  }
}

/** The factory default homepage: all built-in sections, in the locked order, enabled. */
export function defaultLayout(): Block[] {
  return BUILTIN_TYPES.map((type) => ({ id: type, type, enabled: true }));
}

/**
 * Merge a stored layout with the built-in set: keep stored order/enabled/props,
 * append any built-in section missing from storage (so new built-ins appear),
 * and drop unknown types. Built-in ids are their type; gadgets keep their id.
 */
export function normalizeLayout(stored: Block[] | null | undefined): Block[] {
  if (!stored || stored.length === 0) return defaultLayout();
  const seen = new Set<string>();
  const out: Block[] = [];
  for (const b of stored) {
    if (!b || typeof b.type !== 'string') continue;
    if (!isGadget(b.type) && !isBuiltin(b.type)) continue;
    if (isBuiltin(b.type)) {
      if (seen.has(b.type)) continue; // dedupe singletons
      seen.add(b.type);
      out.push({ id: b.type, type: b.type, enabled: b.enabled !== false, props: b.props });
    } else {
      out.push({ id: b.id || `g-${out.length}`, type: b.type, enabled: b.enabled !== false, props: b.props ?? {} });
    }
  }
  // Append any built-in not present (disabled by default so we don't resurrect a section the owner removed intentionally? -> append ENABLED=false to be safe).
  for (const t of BUILTIN_TYPES) {
    if (!seen.has(t)) out.push({ id: t, type: t, enabled: false });
  }
  return out;
}

// ---- Pure editing helpers (used by the admin builder) ----------------------
export function moveBlock(blocks: Block[], id: string, dir: -1 | 1): Block[] {
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const copy = [...blocks];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export function toggleBlock(blocks: Block[], id: string): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b));
}

/** Only gadgets are removable; built-in sections can be disabled but not deleted. */
export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => !(b.id === id && isGadget(b.type)));
}

export function addGadget(blocks: Block[], type: GadgetType, id: string): Block[] {
  return [...blocks, { id, type, enabled: true, props: defaultProps(type) }];
}

// ---- Validation (on save) --------------------------------------------------
const blockSchema = z.object({
  id: z.string().min(1),
  type: z.string(), // validated against known types by normalizeLayout (drops unknowns)
  enabled: z.boolean(),
  props: z.record(z.string(), z.unknown()).optional(),
});
export const layoutSchema = z.array(blockSchema).max(60);

export function parseLayout(json: unknown): Block[] {
  const arr = layoutSchema.parse(json);
  return normalizeLayout(arr as unknown as Block[]);
}
