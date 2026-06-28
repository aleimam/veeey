import { setRequestLocale } from 'next-intl/server';
import { getZones, ZONE_KEYS, type ZoneKey } from '@/lib/page-zone-service';
import { listCollections } from '@/lib/content-service';
import { savePageZoneAction } from '@/server/home-actions';
import { BlockBuilder } from '@/components/admin/home-builder';
import type { Block } from '@/lib/home-layout';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type Coll = { id: string; title: string };

const ZONE_LABELS: Record<ZoneKey, { en: string; ar: string }> = {
  'category.top': { en: 'Above the product grid', ar: 'أعلى شبكة المنتجات' },
  'category.bottom': { en: 'Below the product grid', ar: 'أسفل شبكة المنتجات' },
  'pdp.top': { en: 'Above the product details', ar: 'أعلى تفاصيل المنتج' },
  'pdp.bottom': { en: 'Below the product details', ar: 'أسفل تفاصيل المنتج' },
};

function ZoneCard({ z, locale, label, blocks, collections, saved, savedText, saveLabel }: {
  z: ZoneKey; locale: string; label: string; blocks: Block[]; collections: Coll[]; saved: boolean; savedText: string; saveLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {saved && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{savedText}</span>}
      </div>
      <form action={savePageZoneAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="zone" value={z} />
        <BlockBuilder initialBlocks={blocks} collections={collections} saveLabel={saveLabel} />
      </form>
    </div>
  );
}

export default async function PageSectionsAdmin({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [zones, collections] = await Promise.all([getZones(ZONE_KEYS), listCollections()]);
  const colls: Coll[] = collections.map((c) => ({ id: c.id, title: c.titleEn }));
  const saved = one(sp.saved);
  const savedText = tb('Saved', 'تم الحفظ');
  const saveLabel = tb('Save', 'حفظ');

  const card = (z: ZoneKey) => (
    <ZoneCard z={z} locale={locale} label={tb(ZONE_LABELS[z].en, ZONE_LABELS[z].ar)} blocks={zones[z] ?? []} collections={colls} saved={saved === z} savedText={savedText} saveLabel={saveLabel} />
  );

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{tb('Page sections', 'أقسام الصفحات')}</h1>
      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
        {tb('Add gadget blocks above or below the product listing and the product detail pages. The product grid, filters and buy-box stay in place — these blocks wrap around them.', 'أضف عناصر فوق أو تحت صفحة قائمة المنتجات وصفحة تفاصيل المنتج. تبقى شبكة المنتجات والفلاتر وصندوق الشراء كما هي — تُحيط بها هذه العناصر.')}
      </p>
      {one(sp.error) === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save.', 'تعذّر الحفظ.')}</p>}

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Category / listing page', 'صفحة الفئة / القائمة')}</h2>
        <div className="space-y-4">{card('category.top')}{card('category.bottom')}</div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Product page', 'صفحة المنتج')}</h2>
        <div className="space-y-4">{card('pdp.top')}{card('pdp.bottom')}</div>
      </section>
    </div>
  );
}
