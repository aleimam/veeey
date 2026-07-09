import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listCategories, countCategories } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type Cat = Awaited<ReturnType<typeof listCategories>>[number];

/** Order categories parent-first with descendants indented beneath (recursive —
 *  handles the nested children like Men's Health → Prostate Support). */
function treeOrder(rows: Cat[]): { cat: Cat; depth: number }[] {
  const byParent = new Map<string | null, Cat[]>();
  for (const c of rows) {
    const k = c.parentId ?? null;
    byParent.set(k, [...(byParent.get(k) ?? []), c]);
  }
  const ids = new Set(rows.map((c) => c.id));
  const out: { cat: Cat; depth: number }[] = [];
  const walk = (cat: Cat, depth: number) => {
    out.push({ cat, depth });
    for (const child of byParent.get(cat.id) ?? []) walk(child, depth + 1);
  };
  // Roots = no parent OR parent not in this view (e.g. archived filter).
  for (const root of rows.filter((c) => !c.parentId || !ids.has(c.parentId))) walk(root, 0);
  return out;
}

export default async function CategoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const q = one(sp.q);
  const flag = one(sp.flag);
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: ['name', 'slug'], defaultSort: 'name', defaultDir: 'asc' });
  const opts = { q, archived: showingArchived, flag };

  // Default (unsearched, unfiltered, default sort) view = the 2-level TREE:
  // all categories, parents with their children indented. Any search/filter/
  // re-sort falls back to the flat paginated list.
  const treeMode = !q && !flag && sort === 'name' && dir === 'asc';
  const [categories, total] = await Promise.all([
    listCategories(treeMode ? opts : { ...opts, sort, dir, page, perPage }),
    countCategories(opts),
  ]);
  const rows = treeMode ? treeOrder(categories) : categories.map((cat) => ({ cat, depth: -1 }));

  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  const basePath = `/${locale}/admin/categories`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const guardText = tb(
    'Some selected categories may have children or assigned products — archiving hides them; deleting is blocked while in use. Continue?',
    'قد يكون لبعض الفئات المحددة فئات فرعية أو منتجات — الأرشفة تخفيها؛ والحذف ممنوع أثناء الاستخدام. المتابعة؟',
  );
  const ops: BulkOp[] = [
    showingArchived
      ? { value: 'restore', label: tb('Restore', 'استعادة') }
      : { value: 'archive', label: tb('Archive', 'أرشفة'), confirm: guardText },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true, confirm: guardText },
  ];

  const rowWarn = (c: Cat) => {
    const parts: string[] = [];
    if (c._count.children > 0) parts.push(tb(`${c._count.children} sub-categorie(s)`, `${c._count.children} فئة فرعية`));
    if (c._count.products > 0) parts.push(tb(`${c._count.products} product(s)`, `${c._count.products} منتجًا`));
    if (!parts.length) return undefined;
    return tb(`This category has ${parts.join(' + ')} — removing it may orphan them. Continue?`, `لهذه الفئة ${parts.join(' + ')} — إزالتها قد تتركها بلا فئة. المتابعة؟`);
  };

  const clearHref = `${basePath}${showingArchived ? '?archived=1' : ''}`;
  return (
    <div>
      <AdminList
        title={showingArchived ? `${tl('categories')} ${tc('archivedSuffix')}` : tl('categories')}
        newHref="/admin/categories/edit"
        count={total}
        query={q}
        searchClearHref={clearHref}
        filters={<FilterBar
          fields={[
            { name: 'q', label: tb('Search', 'بحث'), type: 'text' },
            { name: 'flag', label: tb('Data filter', 'تصفية البيانات'), type: 'select', options: [
              { value: 'missing_ar_name', label: tb('Missing Arabic name', 'بدون اسم عربي') },
              { value: 'missing_image', label: tb('Missing image', 'بدون صورة') },
              { value: 'missing_description', label: tb('Missing description', 'بدون وصف') },
              { value: 'zero_products', label: tb('Zero products', 'بدون منتجات') },
            ] },
          ]}
          values={{ q, flag }}
          locale={locale}
          path="categories"
        />}
        head={[{ label: tf('name'), col: 'name' }, tf('parent'), { label: tf('slug'), col: 'slug' }, tb('Products', 'المنتجات')]}
        sortCtx={{ sort, dir, sp, basePath }}
        toolbar={<div className="flex items-center gap-3"><a href={`${basePath}/restructure`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">🗂 {tb('Restructure tool', 'أداة إعادة الهيكلة')}</a><ExportBar entity="categories" locale={locale} query={exportQs(sp)} /><ArchivedToggle path="categories" showingArchived={showingArchived} /></div>}
        notice={<>
          <InUseNotice show={one(sp.error) === 'in_use'} />
          {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
        </>}
        bulk={{ formId: 'bulk-categories', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'category', path: 'categories' }, exportHref: '/api/admin/export/categories' }}
        pagination={treeMode
          ? { page: 1, perPage: Math.max(rows.length, 1), total: rows.length, sp, basePath, locale }
          : { page, perPage, total, sp, basePath, locale }}
        rows={rows.map(({ cat: c, depth }) => ({
          key: c.id,
          cells: [
            depth === 1
              ? <span key="n" className="inline-flex items-center gap-1.5"><span className="text-muted-foreground">└</span> {c.nameEn}</span>
              : depth === 0
                ? <span key="n" className="font-semibold">{c.nameEn}</span>
                : c.nameEn,
            c.parent?.nameEn ?? '—',
            c.slug,
            String(c._count.products),
          ],
          editHref: `/admin/categories/edit/${c.id}`,
          actions: <RowActions entity="category" id={c.id} path="categories" locale={locale} archived={!!c.archivedAt} label={c.nameEn} warn={rowWarn(c)} />,
        }))}
      />
    </div>
  );
}
