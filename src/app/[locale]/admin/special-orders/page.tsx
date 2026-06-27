import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listSpecialOrders } from '@/lib/special-order-service';
import { bulkSpecialOrdersAction } from '@/server/bulk-actions';
import { StatusBadge } from '@/components/admin/ui';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { BulkBar, type BulkOp } from '@/components/admin/bulk-bar';
import { parseListParams, listQs, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const STATUSES = ['REQUESTED', 'DEPOSIT_PAID', 'SOURCING', 'PURCHASED', 'IN_TRANSIT', 'RECEIVED', 'FULFILLED', 'CANCELLED'];

export default async function SpecialOrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const lp = parseListParams(sp, { sortable: ['requester', 'status', 'deadline'], defaultSort: 'deadline', defaultDir: 'asc' });
  const all = await listSpecialOrders();
  const { rows: items, total } = clientPage(all, lp, {
    requester: (s) => s.requesterName ?? s.customer?.user.email ?? '',
    status: (s) => s.status,
    deadline: (s) => (s.deadlineAt ? s.deadlineAt.getTime() : Number.MAX_SAFE_INTEGER),
  });

  const basePath = `/${locale}/admin/special-orders`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const ops: BulkOp[] = [{ value: 'status', label: tb('Set status', 'تعيين الحالة'), values: STATUSES.map((s) => ({ value: s, label: s.replaceAll('_', ' ') })) }];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Special orders', 'الطلبات الخاصة')} ({total})</h1>
        <Link href="/admin/special-orders/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Create special order', 'إنشاء طلب خاص')}</Link>
      </div>
      {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated.`, `تم — ${done}.`)}</p>}
      <BulkBar
        formId="bulk-special"
        action={bulkSpecialOrdersAction}
        locale={locale}
        back={back}
        ops={ops}
        labels={{ selectAllPage: tb('Select page', 'تحديد الصفحة'), selected: tb('selected', 'محدد'), apply: tb('Apply', 'تطبيق'), exportSel: tb('Export selected', 'تصدير المحدد'), confirmDanger: tb('Apply to selected?', 'تطبيق على المحدد؟'), needValue: tb('Choose a status first.', 'اختر حالة أولًا.') }}
      />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 p-3" />
              <SortableTh col="requester" label={tb('Requester', 'مقدّم الطلب')} sort={lp.sort} dir={lp.dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Product', 'المنتج')}</th>
              <SortableTh col="status" label={tb('Status', 'الحالة')} sort={lp.sort} dir={lp.dir} sp={sp} basePath={basePath} />
              <SortableTh col="deadline" label={tb('Deadline', 'الموعد النهائي')} sort={lp.sort} dir={lp.dir} sp={sp} basePath={basePath} />
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-3"><input type="checkbox" name="ids" value={s.id} form="bulk-special" className="size-4" /></td>
                <td className="p-3">
                  <div className="font-medium">{s.requesterName ?? s.customer?.user.email ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">{s.requesterPhone ?? ''}{s.requesterEmail ? ` · ${s.requesterEmail}` : ''}</div>
                </td>
                <td className="p-3">{s.requestedProductText ?? '—'}</td>
                <td className="p-3"><StatusBadge status={s.status} /></td>
                <td className="p-3 text-muted-foreground">{s.deadlineAt ? s.deadlineAt.toISOString().slice(0, 10) : '—'}</td>
                <td className="p-3 text-end"><Link href={`/admin/special-orders/${s.id}`} className="text-primary hover:underline">{tb('Manage', 'إدارة')}</Link></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tb('No special orders yet.', 'لا توجد طلبات خاصة بعد.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <ListPagination page={lp.page} perPage={lp.perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
