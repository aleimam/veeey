import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listOrders } from '@/lib/order-service';
import { ORDER_STATUSES } from '@/lib/order-status';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
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
  const orders = await listOrders({ q, status, payment, payCheck, from, to });

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">{tb('Orders', 'الطلبات')} ({orders.length})</h1>
          <Link href="/admin/orders/new" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('New order', 'طلب جديد')}</Link>
          <ExportBar entity="orders" locale={locale} query={exportQs(sp)} />
        </div>
      </header>

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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Order', 'الطلب')}</th>
              <th className="p-3 text-start">{tb('Customer', 'العميل')}</th>
              <th className="p-3 text-start">{tb('Pharmacist', 'الصيدلي')}</th>
              <th className="p-3 text-start">{tb('Payment', 'الدفع')}</th>
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
              <th className="p-3 text-start">{tb('Items', 'العناصر')}</th>
              <th className="p-3 text-start">{tb('Total', 'الإجمالي')}</th>
              <th className="p-3 text-start">{tb('Tracking', 'التتبع')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3 font-medium">{o.number}</td>
                <td className="p-3 text-muted-foreground">{o.customer?.user.email ?? o.guestEmail ?? tb('Guest', 'زائر')}</td>
                <td className="p-3 text-muted-foreground">{o.pharmacist?.name ?? '—'}</td>
                <td className="p-3">{o.payCheck}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
                <td className="p-3">{o._count.items}</td>
                <td className="p-3">{formatEGP(Number(o.totalPiastres))}</td>
                <td className="p-3 text-muted-foreground">{o.trackingNumber ?? '—'}</td>
                <td className="p-3 text-end"><Link href={`/admin/orders/${o.id}`} className="text-primary hover:underline">{tb('Open', 'فتح')}</Link></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{tb('No orders.', 'لا توجد طلبات.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
