import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listPages } from '@/lib/content-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CmsPagesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const lp = parseListParams(sp, { sortable: ['title', 'slug'], defaultSort: 'title', defaultDir: 'asc' });
  const all = (await listPages()).filter((p) => (showingArchived ? p.status === 'ARCHIVED' : p.status !== 'ARCHIVED'));
  const { rows: pages, total } = clientPage(all, lp, { title: (p) => p.titleEn, slug: (p) => p.slug });
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  const basePath = `/${locale}/admin/content/pages`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const ops: BulkOp[] = [
    showingArchived ? { value: 'restore', label: tb('Restore', 'استعادة') } : { value: 'archive', label: tb('Archive', 'أرشفة') },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true },
  ];

  return (
    <AdminList
      title={showingArchived ? `${tl('cmsPages')} ${tc('archivedSuffix')}` : tl('cmsPages')}
      newHref="/admin/content/pages/edit"
      count={total}
      head={[{ label: tf('title'), col: 'title' }, { label: tf('slug'), col: 'slug' }, tf('status')]}
      sortCtx={{ sort: lp.sort, dir: lp.dir, sp, basePath }}
      toolbar={<ArchivedToggle path="content/pages" showingArchived={showingArchived} />}
      notice={<>
        <InUseNotice show={one(sp.error) === 'in_use'} />
        {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
      </>}
      bulk={{ formId: 'bulk-pages', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'page', path: 'content/pages' } }}
      pagination={{ page: lp.page, perPage: lp.perPage, total, sp, basePath, locale }}
      rows={pages.map((p) => ({
        key: p.id,
        cells: [p.titleEn, p.slug, <StatusBadge key="s" status={p.status} />],
        editHref: `/admin/content/pages/edit/${p.id}`,
        actions: <RowActions entity="page" id={p.id} path="content/pages" locale={locale} archived={p.status === 'ARCHIVED'} />,
      }))}
    />
  );
}
