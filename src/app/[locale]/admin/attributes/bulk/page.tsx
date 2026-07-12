import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { getAiConfig } from '@/lib/provider-config';
import { listBulkAttributes, productsForBulk, autofillMissingCounts, getAutofillStatus } from '@/lib/attribute-bulk-service';
import { isAutofillActive, autofillProgressLine } from '@/lib/attribute-autofill';
import { AttributeBulkEditor } from '@/components/admin/attribute-bulk-editor';
import { startAttributeAutofillAction } from '@/server/attribute-bulk-actions';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type SP = Record<string, string | string[] | undefined>;

export default async function AttributeBulkPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('catalog.write');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';

  const [attributes, cats, brands, aiCfg, missing, autofill] = await Promise.all([
    listBulkAttributes(),
    prisma.category.findMany({ orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true, nameAr: true } }),
    prisma.brand.findMany({ where: { archivedAt: null }, orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true, nameAr: true } }),
    getAiConfig().catch(() => null),
    autofillMissingCounts(),
    getAutofillStatus(),
  ]);
  const jobFlag = one(sp.job);
  const running = isAutofillActive(autofill, new Date());
  const totalMissing = missing.reduce((s, m) => s + m.missing, 0);
  const first = attributes[0];
  const initial = first ? await productsForBulk({ attributeId: first.id }) : { items: [], total: 0 };

  return (
    <div className="p-4 sm:p-6">
      <Link href="/admin/attributes" className="text-sm text-primary hover:underline">← {tb('Attributes', 'الخصائص')}</Link>
      <h1 className="mb-1 mt-1 font-heading text-xl font-semibold text-foreground">{tb('Bulk attribute editor', 'محرّر الخصائص بالجملة')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'Fill product attributes fast so the shop filter sidebar has values. Pick an attribute, filter and select products, then assign a value to all of them — or let AI suggest a value per product for you to review.',
          'املأ خصائص المنتجات بسرعة كي تمتلئ قائمة تصفية المتجر. اختر خاصية، صفِّ واختر المنتجات، ثم عيّن قيمة لها جميعًا — أو دع الذكاء الاصطناعي يقترح قيمة لكل منتج لمراجعتها.',
        )}
      </p>

      {/* One-click auto-fill of every filterable attribute (background job) */}
      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-heading text-sm font-semibold text-foreground">{tb('✨ Auto-fill all filterable attributes', '✨ ملء كل الخصائص القابلة للتصفية تلقائيًا')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {tb(
                'One click AI-tags every product that is missing a value, for every filterable attribute. It only fills gaps — values staff already set are never changed — and picks strictly from each attribute’s allowed values. Runs in the background; refresh this page for progress.',
                'نقرة واحدة تجعل الذكاء الاصطناعي يصنّف كل منتج ينقصه قيمة، لكل خاصية قابلة للتصفية. يملأ الفراغات فقط — لا يغيّر قيمًا وضعها الفريق — ويختار حصريًا من قيم كل خاصية. يعمل في الخلفية؛ حدّث الصفحة لمتابعة التقدم.',
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {tb(`${totalMissing} product-attribute gaps across ${missing.length} filterable attribute(s):`, `${totalMissing} فجوة عبر ${missing.length} خاصية قابلة للتصفية:`)}{' '}
              {missing.map((m) => `${m.nameEn} (${m.missing})`).join(' · ') || tb('none', 'لا شيء')}
            </p>
            {autofill && (
              <p className={`mt-2 text-xs font-medium ${autofill.state === 'error' ? 'text-destructive' : running ? 'text-primary' : 'text-foreground'}`}>
                {running ? tb('Running: ', 'قيد التشغيل: ') : autofill.state === 'error' ? tb('Last run failed: ', 'فشل آخر تشغيل: ') : tb('Last run: ', 'آخر تشغيل: ')}
                {autofillProgressLine(autofill)}
              </p>
            )}
            {jobFlag === 'started' && <p className="mt-2 text-xs font-medium text-primary">{tb('Auto-fill started — refresh for progress.', 'بدأ الملء التلقائي — حدّث لمتابعة التقدم.')}</p>}
            {jobFlag === 'busy' && <p className="mt-2 text-xs font-medium text-destructive">{tb('A run is already in progress.', 'هناك تشغيل جارٍ بالفعل.')}</p>}
            {jobFlag === 'offline' && <p className="mt-2 text-xs font-medium text-destructive">{tb('Job queue unavailable — is the worker running?', 'قائمة المهام غير متاحة — هل العامل يعمل؟')}</p>}
            {!aiCfg && <p className="mt-2 text-xs font-medium text-destructive">{tb('AI is not configured — add an Anthropic key in Providers first.', 'الذكاء الاصطناعي غير مُهيّأ — أضف مفتاح Anthropic في المزوّدين أولًا.')}</p>}
          </div>
          <form action={startAttributeAutofillAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" disabled={!aiCfg || running || totalMissing === 0} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {running ? tb('Running…', 'قيد التشغيل…') : tb('Start auto-fill', 'ابدأ الملء التلقائي')}
            </button>
          </form>
        </div>
      </div>

      {attributes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tb('No attributes yet — create some first.', 'لا خصائص بعد — أنشئ بعضها أولًا.')} <Link href="/admin/attributes" className="text-primary hover:underline">{tb('Attributes', 'الخصائص')}</Link></p>
      ) : (
        <AttributeBulkEditor
          attributes={attributes}
          categories={cats.map((c) => ({ id: c.id, name: ar ? c.nameAr ?? c.nameEn : c.nameEn }))}
          brands={brands.map((b) => ({ id: b.id, name: ar ? b.nameAr ?? b.nameEn : b.nameEn }))}
          aiEnabled={!!aiCfg}
          locale={locale}
          initialItems={initial.items}
          initialTotal={initial.total}
        />
      )}
    </div>
  );
}
