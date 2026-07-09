import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listBrands, countBrands, getBrandTranslateStatus } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { BrandTranslateButton } from '@/components/admin/brand-translate-button';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BrandsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const q = one(sp.q);
  const flag = one(sp.flag);
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: ['name', 'slug'], defaultSort: 'name', defaultDir: 'asc' });
  const opts = { q, archived: showingArchived, flag };
  const [brands, total, missingAr, job] = await Promise.all([
    listBrands({ ...opts, sort, dir, page, perPage }),
    countBrands(opts),
    countBrands({ archived: false, flag: 'missing_ar_name' }),
    getBrandTranslateStatus(),
  ]);
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  const basePath = `/${locale}/admin/brands`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined, tjob: undefined })}`;
  const done = one(sp.done);
  const tjob = one(sp.tjob);
  const guardText = tb(
    'Some selected brands may have assigned products — archiving hides the brand while products keep the link; deleting is blocked for brands in use. Continue?',
    'قد يكون لبعض العلامات المحددة منتجات — الأرشفة تخفي العلامة مع بقاء الربط؛ والحذف ممنوع للعلامات المستخدمة. المتابعة؟',
  );
  const ops: BulkOp[] = [
    showingArchived
      ? { value: 'restore', label: tb('Restore', 'استعادة') }
      : { value: 'archive', label: tb('Archive', 'أرشفة'), confirm: guardText },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true, confirm: guardText },
  ];

  const clearHref = `${basePath}${showingArchived ? '?archived=1' : ''}`;
  return (
    <div>
      <AdminList
        title={showingArchived ? `${tl('brands')} ${tc('archivedSuffix')}` : tl('brands')}
        newHref="/admin/brands/edit"
        count={total}
        head={[{ label: tf('name'), col: 'name' }, tf('nameAr'), { label: tf('slug'), col: 'slug' }, tb('Products', 'المنتجات')]}
        sortCtx={{ sort, dir, sp, basePath }}
        query={q}
        searchClearHref={clearHref}
        filters={<>
          <FilterBar
            fields={[
              { name: 'q', label: tb('Search', 'بحث'), type: 'text' },
              { name: 'flag', label: tb('Data filter', 'تصفية البيانات'), type: 'select', options: [
                { value: 'missing_ar_name', label: tb('Missing Arabic name', 'بدون اسم عربي') },
                { value: 'missing_logo', label: tb('Missing logo', 'بدون شعار') },
                { value: 'missing_banner', label: tb('Missing banner', 'بدون بانر') },
                { value: 'missing_description', label: tb('Missing description', 'بدون وصف') },
                { value: 'zero_products', label: tb('Zero products', 'بدون منتجات') },
              ] },
            ]}
            values={{ q, flag }}
            locale={locale}
            path="brands"
          />
          {tjob === 'started' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Translation job started — Arabic names fill in as the background job runs. Refresh to see progress.', 'بدأت مهمة الترجمة — تُملأ الأسماء العربية أثناء عمل المهمة في الخلفية. حدّث الصفحة لمتابعة التقدم.')}</p>}
          {tjob === 'offline' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not start the job — the background worker is not reachable.', 'تعذّر بدء المهمة — عامل الخلفية غير متاح.')}</p>}
          {job?.state === 'running' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Translating… ${job.done}/${job.total} done${job.failed ? `, ${job.failed} failed` : ''}.`, `جارٍ الترجمة… ${job.done}/${job.total}${job.failed ? `، ${job.failed} فشل` : ''}.`)}</p>}
          {job?.state === 'error' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Last translation job failed — is the AI provider configured (Providers page)?', 'فشلت مهمة الترجمة الأخيرة — هل مزوّد الذكاء الاصطناعي مُفعّل (صفحة المزوّدين)؟')}</p>}
        </>}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <BrandTranslateButton locale={locale} back={back} missing={missingAr} />
            <ExportBar entity="brands" locale={locale} query={exportQs(sp)} />
            <ArchivedToggle path="brands" showingArchived={showingArchived} />
          </div>
        }
        notice={<>
          <InUseNotice show={one(sp.error) === 'in_use'} />
          {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
        </>}
        bulk={{ formId: 'bulk-brands', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'brand', path: 'brands' }, exportHref: '/api/admin/export/brands' }}
        pagination={{ page, perPage, total, sp, basePath, locale }}
        rows={brands.map((b) => ({
          key: b.id,
          cells: [b.nameEn, b.nameAr ?? '—', b.slug, String(b._count.products)],
          editHref: `/admin/brands/edit/${b.id}`,
          actions: (
            <RowActions
              entity="brand"
              id={b.id}
              path="brands"
              locale={locale}
              archived={!!b.archivedAt}
              label={b.nameEn}
              warn={b._count.products > 0 ? tb(`This brand has ${b._count.products} product(s) — removing it may orphan them. Continue?`, `لهذه العلامة ${b._count.products} منتجًا — إزالتها قد تترك المنتجات بلا علامة. المتابعة؟`) : undefined}
            />
          ),
        }))}
      />
    </div>
  );
}
