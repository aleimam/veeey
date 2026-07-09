import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listTags, countTags } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { FilterBar } from '@/components/admin/filter-bar';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TagsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const q = one(sp.q);
  const flag = one(sp.flag);
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: ['name', 'slug'], defaultSort: 'name', defaultDir: 'asc' });
  const opts = { q, archived: showingArchived, flag };
  const [tags, total] = await Promise.all([listTags({ ...opts, sort, dir, page, perPage }), countTags(opts)]);
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  const basePath = `/${locale}/admin/tags`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const ops: BulkOp[] = [
    showingArchived ? { value: 'restore', label: tb('Restore', 'استعادة') } : { value: 'archive', label: tb('Archive', 'أرشفة') },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true },
  ];

  const clearHref = `${basePath}${showingArchived ? '?archived=1' : ''}`;
  const missingAr = (name: string | null) => !name || !name.trim();
  return (
    <div>
      <AdminList
        title={showingArchived ? `${tl('tags')} ${tc('archivedSuffix')}` : tl('tags')}
        newHref="/admin/tags/edit"
        count={total}
        head={[{ label: tf('name'), col: 'name' }, tf('nameAr'), { label: tf('slug'), col: 'slug' }, tb('Products', 'المنتجات')]}
        sortCtx={{ sort, dir, sp, basePath }}
        query={q}
        searchClearHref={clearHref}
        filters={<FilterBar
          fields={[
            { name: 'q', label: tb('Search', 'بحث'), type: 'text' },
            { name: 'flag', label: tb('Data filter', 'تصفية البيانات'), type: 'select', options: [
              { value: 'missing_ar_name', label: tb('Missing Arabic name', 'بدون اسم عربي') },
              { value: 'zero_products', label: tb('Zero products', 'بدون منتجات') },
            ] },
          ]}
          values={{ q, flag }}
          locale={locale}
          path="tags"
        />}
        toolbar={<ArchivedToggle path="tags" showingArchived={showingArchived} />}
        notice={<>
          <InUseNotice show={one(sp.error) === 'in_use'} />
          {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
        </>}
        bulk={{ formId: 'bulk-tags', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'tag', path: 'tags' } }}
        pagination={{ page, perPage, total, sp, basePath, locale }}
        emptyState={<span>{tb('No tags yet. Tags are keyword labels you attach to products (e.g. “vegan”, “bestseller”) to group and filter them across the store.', 'لا توجد وسوم بعد. الوسوم هي كلمات مفتاحية تربطها بالمنتجات (مثل «نباتي» أو «الأكثر مبيعًا») لتجميعها وتصفيتها في المتجر.')}</span>}
        rows={tags.map((t) => ({
          key: t.id,
          cells: [
            t.nameEn,
            missingAr(t.nameAr)
              ? <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title={tb('No Arabic translation', 'لا توجد ترجمة عربية')}>⚠ {tb('Missing AR', 'بدون عربي')}</span>
              : t.nameAr,
            t.slug,
            t._count.products > 0
              ? <Link href={`/admin/products?tag=${t.id}`} className="text-primary hover:underline" title={tb('View products with this tag', 'عرض المنتجات بهذا الوسم')}>{t._count.products}</Link>
              : <span className="text-muted-foreground">0</span>,
          ],
          editHref: `/admin/tags/edit/${t.id}`,
          actions: <RowActions entity="tag" id={t.id} path="tags" locale={locale} archived={!!t.archivedAt} label={t.nameEn} />,
        }))}
      />
    </div>
  );
}
