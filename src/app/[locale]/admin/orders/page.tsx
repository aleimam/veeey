import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listOrders } from '@/lib/order-service';
import { ORDER_STATUSES } from '@/lib/order-status';
import { formatEGP } from '@/lib/format';
import { StatusBadge, inputCls } from '@/components/admin/ui';
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
  const status = one(sp.status);
  const payCheck = one(sp.payCheck);
  const orders = await listOrders({ status, payCheck });

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">{tb('Orders', 'الطلبات')} ({orders.length})</h1>
          <Link href="/admin/orders/new" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('New order', 'طلب جديد')}</Link>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <select name="status" defaultValue={status ?? ''} className={`${inputCls} w-44`}>
            <option value="">{tb('All statuses', 'كل الحالات')}</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select name="payCheck" defaultValue={payCheck ?? ''} className={`${inputCls} w-36`}>
            <option value="">{tb('Payment check', 'مراجعة الدفع')}</option>
            {['NO', 'YES', 'PROBLEM'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="rounded-md border border-border px-3 py-2 hover:bg-surface">{tb('Filter', 'تصفية')}</button>
          <a href={`/api/admin/orders/export`} className="rounded-md bg-slate px-3 py-2 font-medium text-slate-foreground">{tb('Export CSV', 'تصدير CSV')}</a>
        </form>
      </header>

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
