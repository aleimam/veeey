import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listAttributes } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AttributesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const lp = parseListParams(sp, { sortable: ['name', 'key', 'values'], defaultSort: 'name', defaultDir: 'asc' });
  const all = (await listAttributes()).filter((a) => (showingArchived ? a.archivedAt : !a.archivedAt));
  const { rows: attributes, total } = clientPage(all, lp, { name: (a) => a.nameEn, key: (a) => a.key, values: (a) => a.values.length });
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  const basePath = `/${locale}/admin/attributes`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const ops: BulkOp[] = [
    showingArchived ? { value: 'restore', label: tb('Restore', 'استعادة') } : { value: 'archive', label: tb('Archive', 'أرشفة') },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true },
  ];

  return (
    <AdminList
      title={showingArchived ? `${tl('attributes')} ${tc('archivedSuffix')}` : tl('attributes')}
      newHref="/admin/attributes/edit"
      count={total}
      head={[{ label: tf('name'), col: 'name' }, { label: tf('key'), col: 'key' }, tb('Applies to', 'ينطبق على'), { label: tf('values'), col: 'values' }]}
      sortCtx={{ sort: lp.sort, dir: lp.dir, sp, basePath }}
      toolbar={<ArchivedToggle path="attributes" showingArchived={showingArchived} />}
      notice={<>
        <InUseNotice show={one(sp.error) === 'in_use'} />
        {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
      </>}
      bulk={{ formId: 'bulk-attributes', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'attribute', path: 'attributes' } }}
      pagination={{ page: lp.page, perPage: lp.perPage, total, sp, basePath, locale }}
      rows={attributes.map((a) => ({
        key: a.id,
        cells: [
          <span key="n">{a.nameEn}{a.isFilterable ? <span className="ms-1.5 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">{tb('filter', 'فلتر')}</span> : null}</span>,
          a.key,
          (a.kinds.length ? a.kinds : [a.kind]).map((k) => k[0] + k.slice(1).toLowerCase()).join(', '),
          String(a.values.length),
        ],
        editHref: `/admin/attributes/edit/${a.id}`,
        actions: <RowActions entity="attribute" id={a.id} path="attributes" locale={locale} archived={!!a.archivedAt} label={a.nameEn} />,
      }))}
    />
  );
}
