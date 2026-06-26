import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listOrders, countOrders } from '@/lib/order-service';
import { ORDER_STATUSES } from '@/lib/order-status';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { BulkBar, type BulkOp } from '@/components/admin/bulk-bar';
import { bulkOrdersAction } from '@/server/bulk-actions';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SORTABLE = ['number', 'status', 'total', 'placedAt'] as const;

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const q = one(sp.q);
  const status = one(sp.status);
  const payment = one(sp.payment);
  const payCheck = one(sp.payCheck);
  const from = one(sp.from);
  const to = one(sp.to);
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: SORTABLE, defaultSort: 'placedAt' });
  const filters = { q, status, payment, payCheck, from, to };

  const [orders, total] = await Promise.all([
    listOrders({ ...filters, sort, dir, page, perPage }),
    countOrders(filters),
  ]);

  const basePath = `/${locale}/admin/orders`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined, error: undefined })}`;
  const done = one(sp.done);

  const ops: BulkOp[] = [
    { value: 'status', label: tb('Set status', 'تعيين الحالة'), values: ORDER_STATUSES.map((s) => ({ value: s, label: s.replaceAll('_', ' ') })) },
    { value: 'payCheck', label: tb('Set payment check', 'مراجعة الدفع'), values: ['NO', 'YES', 'PROBLEM'].map((p) => ({ value: p, label: p })) },
  ];

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">{tb('Orders', 'الطلبات')} ({total})</h1>
          <Link href="/admin/orders/new" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('New order', 'طلب جديد')}</Link>
          <ExportBar entity="orders" locale={locale} query={exportQs(sp)} />
        </div>
      </header>

      {done != null && (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(`Updated ${done} order(s).`, `تم تحديث ${done} طلب.`)}{Number(one(sp.skip)) > 0 ? tb(` ${one(sp.skip)} skipped (invalid transition).`, ` تم تخطّي ${one(sp.skip)} (انتقال غير صالح).`) : ''}
        </p>
      )}
      {one(sp.error) === 'bulk' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Bulk action failed.', 'فشل الإجراء الجماعي.')}</p>}

      <FilterBar
        locale={locale}
        path="orders"
        values={{ q, status, payment, payCheck, from, to }}
        fields={[
          { name: 'q', label: tb('Order number', 'رقم الطلب'), type: 'text', placeholder: tb('Order number', 'رقم الطلب') },
          { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: ORDER_STATUSES.map((s) => ({ value: s, label: s })) },
          { name: 'payment', label: tb('Payment', 'الدفع'), type: 'select', options: ['COD', 'POS_ON_DELIVERY', 'KASHIER', 'BANK_TRANSFER', 'WALLET'].map((p) => ({ value: p, label: p })) },
          { name: 'payCheck', label: tb('Payment check', 'مراجعة الدفع'), type: 'select', options: ['NO', 'YES', 'PROBLEM'].map((p) => ({ value: p, label: p })) },
          { name: 'from', label: tb('From', 'من'), type: 'date' },
          { name: 'to', label: tb('To', 'إلى'), type: 'date' },
        ]}
      />

      <BulkBar
        formId="bulk-orders"
        action={bulkOrdersAction}
        locale={locale}
        back={back}
        ops={ops}
        exportHref="/api/admin/export/orders"
        labels={{ selectAllPage: tb('Select page', 'تحديد الصفحة'), selected: tb('selected', 'محدد'), apply: tb('Apply', 'تطبيق'), exportSel: tb('Export selected', 'تصدير المحدد'), confirmDanger: tb('Apply to the selected orders?', 'تطبيق على الطلبات المحددة؟'), needValue: tb('Choose a value first.', 'اختر قيمة أولًا.') }}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 p-3" />
              <SortableTh col="number" label={tb('Order', 'الطلب')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Customer', 'العميل')}</th>
              <th className="p-3 text-start">{tb('Pharmacist', 'الصيدلي')}</th>
              <th className="p-3 text-start">{tb('Payment', 'الدفع')}</th>
              <SortableTh col="status" label={tb('Status', 'الحالة')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Items', 'العناصر')}</th>
              <SortableTh col="total" label={tb('Total', 'الإجمالي')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="placedAt" label={tb('Placed', 'التاريخ')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3"><input type="checkbox" name="ids" value={o.id} form="bulk-orders" className="size-4" aria-label={o.number} /></td>
                <td className="p-3 font-medium">{o.number}</td>
                <td className="p-3 text-muted-foreground">{o.customer?.user.email ?? o.guestEmail ?? tb('Guest', 'زائر')}</td>
                <td className="p-3 text-muted-foreground">{o.pharmacist?.name ?? '—'}</td>
                <td className="p-3">{o.payCheck}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
                <td className="p-3">{o._count.items}</td>
                <td className="p-3">{formatEGP(Number(o.totalPiastres))}</td>
                <td className="p-3 text-muted-foreground">{new Date(o.placedAt).toISOString().slice(0, 10)}</td>
                <td className="p-3 text-end"><Link href={`/admin/orders/${o.id}`} className="text-primary hover:underline">{tb('Open', 'فتح')}</Link></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{tb('No orders match.', 'لا توجد طلبات مطابقة.')}</td></tr>}
          </tbody>
        </table>
      </div>

      <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
