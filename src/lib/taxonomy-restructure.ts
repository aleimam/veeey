import { slugify } from '@/lib/sku';

/**
 * Category-taxonomy restructure planner (V2 CAT-4) — PURE. Builds a dry-run
 * plan mapping the existing categories onto the owner-approved target tree
 * (V2.docx): 4 top-level parents with fixed children (some nested). The
 * service layer executes the plan; owner decisions: dry-run + one-click
 * apply, merged/duplicate categories are ARCHIVED (reversible), everything
 * logged. Existing categories that match nothing are reported for manual
 * follow-up rather than guessed.
 */

export type TargetNode = {
  key: string; // stable machine key
  name: string; // canonical English name
  nameAr?: string; // seed Arabic name for created/renamed records
  slug?: string; // explicit slug (else slugify(name))
  aliases?: string[]; // existing EN names/slugs that MERGE into this node
  aliasesAr?: string[]; // Arabic duplicate names that merge here (label kept as nameAr)
  children?: TargetNode[];
};

export const TARGET_TREE: TargetNode[] = [
  {
    key: 'vitamins-supplements', name: 'Vitamins & Supplements', nameAr: 'الفيتامينات والمكملات',
    children: [
      { key: 'vitamins', name: 'Vitamins', nameAr: 'فيتامينات', aliasesAr: ['فيتامينات'] },
      { key: 'minerals', name: 'Minerals', nameAr: 'معادن', aliasesAr: ['معادن', 'المعادن'] },
      { key: 'herbal', name: 'Herbal Supplements', nameAr: 'مكملات عشبية', aliases: ['Herbal', 'Herbs'], aliasesAr: ['أعشاب', 'مكملات عشبية'] },
      { key: 'amino-acids', name: 'Amino Acids', nameAr: 'أحماض أمينية', aliasesAr: ['أحماض أمينية'] },
      { key: 'omega', name: 'Omega Fatty Acids & Fish Oils', nameAr: 'أوميجا وزيوت السمك', aliases: ['Omega', 'Fish Oil', 'Fish Oils', 'Omega 3'], aliasesAr: ['أوميجا', 'زيت السمك'] },
      { key: 'probiotics', name: 'Probiotics & Prebiotics', nameAr: 'بروبيوتيك وبريبايوتيك', aliases: ['Probiotics', 'Prebiotics'], aliasesAr: ['بروبيوتيك'] },
      { key: 'enzymes', name: 'Enzymes', nameAr: 'إنزيمات', aliasesAr: ['إنزيمات', 'انزيمات'] },
      { key: 'specialty', name: 'Specialty Formulas', nameAr: 'تركيبات متخصصة', aliases: ['Antioxidant', 'Antioxidants', 'Antioxidant Blends', 'NMN'], aliasesAr: ['مضادات الأكسدة'] },
    ],
  },
  {
    key: 'wellness-goals', name: 'Health & Wellness Goals', nameAr: 'أهداف الصحة والعافية',
    children: [
      { key: 'immune', name: 'Immune Support', nameAr: 'دعم المناعة', aliases: ['Immunity', 'Immune'], aliasesAr: ['مناعة', 'المناعة'] },
      { key: 'energy', name: 'Energy & Vitality', nameAr: 'الطاقة والحيوية', aliases: ['Energy'], aliasesAr: ['طاقة', 'الطاقة'] },
      { key: 'brain', name: 'Brain & Cognitive Health', nameAr: 'صحة الدماغ والإدراك', aliases: ['Brain', 'Brain Health', 'Memory', 'Cognitive'], aliasesAr: ['الدماغ', 'الذاكرة'] },
      { key: 'heart', name: 'Heart & Cardiovascular Health', nameAr: 'صحة القلب والأوعية', aliases: ['Heart', 'Heart Health', 'Cardiovascular'], aliasesAr: ['القلب', 'صحة القلب'] },
      { key: 'bone-joint', name: 'Bone & Joint Support', nameAr: 'دعم العظام والمفاصل', aliases: ['Bones & Joints', 'Bone & Joint', 'Joints', 'Bone Health'], aliasesAr: ['العظام', 'المفاصل', 'العظام والمفاصل'] },
      { key: 'digestive', name: 'Digestive Health & Gut Flora', nameAr: 'صحة الجهاز الهضمي', aliases: ['Digestive Health', 'Digestion', 'Gut Health', 'Digestive'], aliasesAr: ['الهضم', 'الجهاز الهضمي'] },
      { key: 'sleep', name: 'Sleep & Relaxation', nameAr: 'النوم والاسترخاء', aliases: ['Sleep', 'Relaxation'], aliasesAr: ['النوم', 'الاسترخاء'] },
      { key: 'weight', name: 'Weight Management', nameAr: 'إدارة الوزن', aliases: ['Weight Loss', 'Slimming', 'Diet'], aliasesAr: ['التخسيس', 'إنقاص الوزن', 'الوزن'] },
      { key: 'detox', name: 'Detox & Cleanse', nameAr: 'التخلص من السموم', aliases: ['Detox', 'Cleanse'], aliasesAr: ['ديتوكس'] },
      {
        key: 'mens', name: "Men's Health", nameAr: 'صحة الرجل', aliases: ['Men', 'Mens Health', "Men's"], aliasesAr: ['صحة الرجل', 'الرجل'],
        children: [
          { key: 'prostate', name: 'Prostate Support', nameAr: 'دعم البروستاتا', aliases: ['Prostate'], aliasesAr: ['البروستاتا'] },
          { key: 'performance', name: 'Performance', nameAr: 'الأداء', aliasesAr: ['الأداء'] },
        ],
      },
      {
        key: 'womens', name: "Women's Health", nameAr: 'صحة المرأة',
        aliases: ['Women', 'Womens Health', "Women's", 'Women & Prenatal Supplements', 'Fertility Supplements', 'Fertility'],
        aliasesAr: ['صحة المرأة', 'المرأة'],
        children: [
          { key: 'prenatal', name: 'Prenatal', nameAr: 'ما قبل الولادة', aliases: ['Prenatal Supplements'], aliasesAr: ['الحمل'] },
          { key: 'menopause', name: 'Menopause', nameAr: 'سن اليأس', aliasesAr: ['سن اليأس'] },
        ],
      },
      { key: 'childrens', name: "Children's Health", nameAr: 'صحة الأطفال', slug: 'childrens-health', aliases: ['Babies & Kids', 'Kids', 'Children', 'Kids Health', 'babies-kids'], aliasesAr: ['الأطفال', 'صحة الأطفال'] },
      { key: 'senior', name: 'Senior Health', nameAr: 'صحة كبار السن', aliases: ['Seniors'], aliasesAr: ['كبار السن'] },
      { key: 'sports', name: 'Sports Nutrition', nameAr: 'التغذية الرياضية', aliases: ['Sports', 'Fitness'], aliasesAr: ['الرياضة', 'التغذية الرياضية'] },
      { key: 'eye', name: 'Eye Health', nameAr: 'صحة العين', slug: 'eye-health', aliases: ['Eye & Vision', 'Vision', 'eye-vision'], aliasesAr: ['العين', 'صحة العين'] },
      { key: 'longevity', name: 'Longevity & Anti-Aging', nameAr: 'طول العمر ومكافحة الشيخوخة', aliases: ['Anti-Aging', 'Longevity', 'Anti Aging'], aliasesAr: ['مكافحة الشيخوخة'] },
    ],
  },
  {
    key: 'personal-care', name: 'Personal Care & Beauty', nameAr: 'العناية الشخصية والجمال',
    children: [
      {
        key: 'skin-care', name: 'Skin Care (Topical)', nameAr: 'العناية بالبشرة', slug: 'skin-care-topical', aliases: ['Skin Care', 'Skincare', 'Skin'], aliasesAr: ['البشرة', 'العناية بالبشرة'],
        children: [
          { key: 'serums', name: 'Serums', nameAr: 'سيروم', aliasesAr: ['سيروم'] },
          { key: 'moisturizers', name: 'Moisturizers/Creams', nameAr: 'مرطبات وكريمات', slug: 'moisturizers-creams', aliases: ['Moisturizers', 'Creams'], aliasesAr: ['مرطبات', 'كريمات'] },
          { key: 'cleansers', name: 'Cleansers', nameAr: 'منظفات', aliasesAr: ['منظفات'] },
          { key: 'sunscreens', name: 'Sunscreens', nameAr: 'واقيات الشمس', aliasesAr: ['واقي الشمس'] },
          { key: 'skin-treatments', name: 'Treatments', nameAr: 'علاجات البشرة', slug: 'skin-treatments' },
        ],
      },
      {
        key: 'hair-care', name: 'Hair Care (Topical)', nameAr: 'العناية بالشعر', slug: 'hair-care-topical', aliases: ['Hair Care', 'Hair'], aliasesAr: ['الشعر', 'العناية بالشعر'],
        children: [
          { key: 'shampoos', name: 'Shampoos', nameAr: 'شامبو', aliasesAr: ['شامبو'] },
          { key: 'conditioners', name: 'Conditioners', nameAr: 'بلسم', aliasesAr: ['بلسم'] },
          { key: 'hair-treatments', name: 'Treatments', nameAr: 'علاجات الشعر', slug: 'hair-treatments' },
        ],
      },
      { key: 'beauty-supplements', name: 'Beauty Supplements', nameAr: 'مكملات الجمال', aliases: ['Collagen', 'Biotin', 'Hair Skin Nails', 'Hair/Skin/Nails', 'Hair, Skin & Nails'], aliasesAr: ['الكولاجين', 'البيوتين'] },
    ],
  },
  {
    key: 'devices', name: 'Medical Devices', nameAr: 'الأجهزة الطبية', aliases: ['Health Devices', 'Devices', 'Public Health'], aliasesAr: ['أجهزة طبية', 'الأجهزة الطبية'],
    children: [
      { key: 'monitoring', name: 'Monitoring Devices', nameAr: 'أجهزة القياس', aliases: ['Monitors'], aliasesAr: ['أجهزة القياس'] },
      { key: 'therapeutic', name: 'Therapeutic Devices', nameAr: 'أجهزة علاجية', aliasesAr: ['أجهزة علاجية'] },
      { key: 'diagnostic', name: 'Diagnostic Tools', nameAr: 'أدوات التشخيص', aliasesAr: ['أدوات التشخيص'] },
      { key: 'beauty-devices', name: 'Beauty Devices', nameAr: 'أجهزة التجميل', aliasesAr: ['أجهزة التجميل'] },
      { key: 'respiratory', name: 'Respiratory Aids', nameAr: 'أجهزة التنفس', aliases: ['Respiratory System Supplements', 'Respiratory'], aliasesAr: ['الجهاز التنفسي'] },
    ],
  },
];

/** Existing categories not in the target that ADOPT a parent (doc: keep as
 *  children under the mapped parent, with slug/typos fixed). */
const ADOPT_RULES: { match: string[]; underKey: string; fixSlug?: string }[] = [
  { match: ['Liver & Kidney Supplements', 'abdomen-organs'], underKey: 'wellness-goals', fixSlug: 'liver-kidney-supplements' },
  { match: ['Pain & Relief Supplements', 'pain-releif', 'Pain Relief'], underKey: 'wellness-goals', fixSlug: 'pain-relief-supplements' },
];

// --- matching ----------------------------------------------------------------

const AR_RE = /[؀-ۿ]/;

export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Relaxed form for existing-category names only: drops a trailing/leading
 *  "supplements" word ("Energy Supplements" → energy). Node keys are indexed
 *  with the strict form so e.g. the "vitamins-supplements" PARENT slug can
 *  never shadow the "Vitamins" child. */
const relaxed = (s: string) => normName(s).replace(/\b(supplements?|قسم)\b/g, ' ').replace(/\s+/g, ' ').trim();

export type FlatNode = TargetNode & { parentKey: string | null; depth: number; finalSlug: string };

export function flattenTree(tree: TargetNode[] = TARGET_TREE): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (nodes: TargetNode[], parentKey: string | null, depth: number) => {
    for (const n of nodes) {
      out.push({ ...n, parentKey, depth, finalSlug: n.slug ?? slugify(n.name) });
      if (n.children) walk(n.children, n.key, depth + 1);
    }
  };
  walk(tree, null, 0);
  return out;
}

export type ExistingCat = {
  id: string; nameEn: string; nameAr: string | null; slug: string;
  parentId: string | null; archived: boolean; products: number; children: number;
};

export type RestructurePlan = {
  nodes: FlatNode[];
  /** nodeKey → primary existing category (renamed/re-slugged/re-parented in place). */
  assign: { nodeKey: string; id: string; oldName: string; oldSlug: string; rename: boolean; reslug: boolean; products: number }[];
  /** nodes with no existing match — created fresh. */
  create: { nodeKey: string }[];
  /** duplicates merged into the node's record (products moved, source archived). */
  merge: { fromId: string; fromName: string; products: number; intoKey: string; keepAsNameAr: boolean }[];
  /** not in the target — re-parented under a mapped parent (kept, not deleted). */
  adopt: { id: string; name: string; underKey: string; fixSlug?: string; oldSlug: string; products: number }[];
  /** nothing matched — reported for manual follow-up; NOT touched by apply. */
  unmatched: { id: string; name: string; products: number; isArabic: boolean }[];
  /** slug changes → Redirect rows (old category URL keeps resolving). */
  redirects: { from: string; to: string }[];
};

export function buildRestructurePlan(existing: ExistingCat[]): RestructurePlan {
  const nodes = flattenTree();
  const byNorm = new Map<string, FlatNode>();
  const ambiguous = new Set<string>();
  for (const n of nodes) {
    const keys = [n.name, n.finalSlug, ...(n.aliases ?? []), ...(n.aliasesAr ?? []), ...(n.nameAr ? [n.nameAr] : [])];
    for (const k of keys) {
      const norm = normName(k);
      if (!norm) continue;
      const prev = byNorm.get(norm);
      if (prev && prev !== n) ambiguous.add(norm); // e.g. bare "Treatments" (skin vs hair)
      else if (!prev) byNorm.set(norm, n);
    }
  }
  // A name shared by two different nodes can't be matched safely — a category
  // named just "Treatments" would land under skin even if it's hair. Drop the
  // key so such categories surface as UNMATCHED for a human call instead.
  // (Slugs stay unique by construction, so slug matching is unaffected.)
  for (const k of ambiguous) byNorm.delete(k);

  const active = existing.filter((c) => !c.archived);
  const assign: RestructurePlan['assign'] = [];
  const merge: RestructurePlan['merge'] = [];
  const adopt: RestructurePlan['adopt'] = [];
  const unmatched: RestructurePlan['unmatched'] = [];
  const redirects: RestructurePlan['redirects'] = [];
  const primaryOf = new Map<string, string>(); // nodeKey → existing id

  const matchNode = (c: ExistingCat): FlatNode | undefined =>
    byNorm.get(normName(c.nameEn)) ??
    byNorm.get(normName(c.slug)) ??
    (c.nameAr ? byNorm.get(normName(c.nameAr)) : undefined) ??
    byNorm.get(relaxed(c.nameEn)) ??
    byNorm.get(relaxed(c.slug));

  // Exact/alias matches first, sorted so higher-product categories become the
  // primary record for a node (keeps the most links stable).
  const sorted = [...active].sort((a, b) => b.products - a.products);
  const claimed = new Set<string>();

  for (const c of sorted) {
    const node = matchNode(c);
    if (!node) continue;
    claimed.add(c.id);
    if (!primaryOf.has(node.key)) {
      primaryOf.set(node.key, c.id);
      const rename = c.nameEn !== node.name;
      const reslug = c.slug !== node.finalSlug;
      if (reslug) redirects.push({ from: `/products?category=${c.slug}`, to: `/products?category=${node.finalSlug}` });
      assign.push({ nodeKey: node.key, id: c.id, oldName: c.nameEn, oldSlug: c.slug, rename, reslug, products: c.products });
    } else {
      merge.push({ fromId: c.id, fromName: c.nameEn, products: c.products, intoKey: node.key, keepAsNameAr: AR_RE.test(c.nameEn) });
      redirects.push({ from: `/products?category=${c.slug}`, to: `/products?category=${node.finalSlug}` });
    }
  }

  for (const c of active) {
    if (claimed.has(c.id)) continue;
    const rule = ADOPT_RULES.find((r) => r.match.some((m) => normName(m) === normName(c.nameEn) || normName(m) === normName(c.slug)));
    if (rule) {
      adopt.push({ id: c.id, name: c.nameEn, underKey: rule.underKey, fixSlug: rule.fixSlug, oldSlug: c.slug, products: c.products });
      if (rule.fixSlug && rule.fixSlug !== c.slug) redirects.push({ from: `/products?category=${c.slug}`, to: `/products?category=${rule.fixSlug}` });
    } else {
      unmatched.push({ id: c.id, name: c.nameEn, products: c.products, isArabic: AR_RE.test(c.nameEn) });
    }
  }

  const create = nodes.filter((n) => !primaryOf.has(n.key)).map((n) => ({ nodeKey: n.key }));
  return { nodes, assign, create, merge, adopt, unmatched, redirects };
}
