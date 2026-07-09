import { setRequestLocale, getTranslations } from 'next-intl/server';
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
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: ['name', 'slug'], defaultSort: 'name', defaultDir: 'asc' });
  const opts = { q, archived: showingArchived };
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
  return (
    <div>
      <AdminList
        title={showingArchived ? `${tl('tags')} ${tc('archivedSuffix')}` : tl('tags')}
        newHref="/admin/tags/edit"
        count={total}
        head={[{ label: tf('name'), col: 'name' }, tf('nameAr'), { label: tf('slug'), col: 'slug' }]}
        sortCtx={{ sort, dir, sp, basePath }}
        query={q}
        searchClearHref={clearHref}
        filters={<FilterBar fields={[{ name: 'q', label: tb('Search', 'بحث'), type: 'text' }]} values={{ q }} locale={locale} path="tags" />}
        toolbar={<ArchivedToggle path="tags" showingArchived={showingArchived} />}
        notice={<>
          <InUseNotice show={one(sp.error) === 'in_use'} />
          {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
        </>}
        bulk={{ formId: 'bulk-tags', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'tag', path: 'tags' } }}
        pagination={{ page, perPage, total, sp, basePath, locale }}
        rows={tags.map((t) => ({
          key: t.id,
          cells: [t.nameEn, t.nameAr ?? '—', t.slug],
          editHref: `/admin/tags/edit/${t.id}`,
          actions: <RowActions entity="tag" id={t.id} path="tags" locale={locale} archived={!!t.archivedAt} label={t.nameEn} />,
        }))}
      />
    </div>
  );
}
