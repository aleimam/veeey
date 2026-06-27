import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listGifts } from '@/lib/gift-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function GiftsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const lp = parseListParams(sp, { sortable: ['code', 'name', 'stock'], defaultSort: 'code', defaultDir: 'asc' });
  const all = (await listGifts()).filter((g) => (showingArchived ? g.archivedAt : !g.archivedAt));
  const { rows: gifts, total } = clientPage(all, lp, { code: (g) => g.code, name: (g) => g.internalName, stock: (g) => g.stock });
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  const basePath = `/${locale}/admin/gifts`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const ops: BulkOp[] = [
    showingArchived ? { value: 'restore', label: tb('Restore', 'استعادة') } : { value: 'archive', label: tb('Archive', 'أرشفة') },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true },
  ];

  return (
    <AdminList
      title={showingArchived ? `${tl('gifts')} ${tc('archivedSuffix')}` : tl('gifts')}
      newHref="/admin/gifts/edit"
      count={total}
      head={[{ label: tf('code'), col: 'code' }, { label: tf('internalName'), col: 'name' }, { label: tf('stock'), col: 'stock' }, tf('expiry')]}
      sortCtx={{ sort: lp.sort, dir: lp.dir, sp, basePath }}
      toolbar={<ArchivedToggle path="gifts" showingArchived={showingArchived} />}
      notice={<>
        <InUseNotice show={one(sp.error) === 'in_use'} />
        {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
      </>}
      bulk={{ formId: 'bulk-gifts', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'gift', path: 'gifts' } }}
      pagination={{ page: lp.page, perPage: lp.perPage, total, sp, basePath, locale }}
      rows={gifts.map((g) => ({
        key: g.id,
        cells: [g.code, g.internalName, String(g.stock), g.expiry ? g.expiry.toISOString().slice(0, 10) : '—'],
        editHref: `/admin/gifts/edit/${g.id}`,
        actions: <RowActions entity="gift" id={g.id} path="gifts" locale={locale} archived={!!g.archivedAt} />,
      }))}
    />
  );
}
