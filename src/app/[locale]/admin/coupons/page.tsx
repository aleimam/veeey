import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listCoupons } from '@/lib/coupon-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CouponsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const lp = parseListParams(sp, { sortable: ['code', 'value'], defaultSort: 'code', defaultDir: 'asc' });
  const all = (await listCoupons()).filter((c) => (showingArchived ? !c.active : c.active));
  const { rows: coupons, total } = clientPage(all, lp, { code: (c) => c.code, value: (c) => c.value });
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  const basePath = `/${locale}/admin/coupons`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const ops: BulkOp[] = [
    showingArchived ? { value: 'restore', label: tb('Activate', 'تفعيل') } : { value: 'archive', label: tb('Deactivate', 'إلغاء التفعيل') },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true },
  ];

  return (
    <AdminList
      title={showingArchived ? `${tl('coupons')} ${tc('archivedSuffix')}` : tl('coupons')}
      newHref="/admin/coupons/edit"
      count={total}
      head={[{ label: tf('code'), col: 'code' }, tf('type'), { label: tf('value'), col: 'value' }, tf('active')]}
      sortCtx={{ sort: lp.sort, dir: lp.dir, sp, basePath }}
      toolbar={<ArchivedToggle path="coupons" showingArchived={showingArchived} />}
      notice={<>
        <InUseNotice show={one(sp.error) === 'in_use'} />
        {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
      </>}
      bulk={{ formId: 'bulk-coupons', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'coupon', path: 'coupons' } }}
      pagination={{ page: lp.page, perPage: lp.perPage, total, sp, basePath, locale }}
      rows={coupons.map((c) => ({
        key: c.id,
        cells: [c.code, c.type, c.type === 'PERCENT' ? `${c.value}%` : `${c.value} EGP`, c.active ? 'Yes' : '—'],
        editHref: `/admin/coupons/edit/${c.id}`,
        actions: <RowActions entity="coupon" id={c.id} path="coupons" locale={locale} archived={!c.active} />,
      }))}
    />
  );
}
