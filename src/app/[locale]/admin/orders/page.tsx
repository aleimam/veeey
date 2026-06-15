import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listOrders } from '@/lib/order-service';
import { ORDER_STATUSES } from '@/lib/order-status';
import { formatEGP } from '@/lib/format';
import { StatusBadge, inputCls } from '@/components/admin/ui';

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
  const status = one(sp.status);
  const payCheck = one(sp.payCheck);
  const orders = await listOrders({ status, payCheck });

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">الطلبات ({orders.length})</h1>
          <Link href="/admin/orders/new" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">طلب جديد</Link>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <select name="status" defaultValue={status ?? ''} className={`${inputCls} w-44`}>
            <option value="">كل الحالات</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select name="payCheck" defaultValue={payCheck ?? ''} className={`${inputCls} w-36`}>
            <option value="">مراجعة الدفع</option>
            {['NO', 'YES', 'PROBLEM'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="rounded-md border border-border px-3 py-2 hover:bg-surface">تصفية</button>
          <a href={`/api/admin/orders/export`} className="rounded-md bg-slate px-3 py-2 font-medium text-slate-foreground">تصدير CSV</a>
        </form>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">الطلب</th>
              <th className="p-3 text-start">العميل</th>
              <th className="p-3 text-start">الصيدلي</th>
              <th className="p-3 text-start">الدفع</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">العناصر</th>
              <th className="p-3 text-start">الإجمالي</th>
              <th className="p-3 text-start">التتبع</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3 font-medium">{o.number}</td>
                <td className="p-3 text-muted-foreground">{o.customer?.user.email ?? o.guestEmail ?? 'زائر'}</td>
                <td className="p-3 text-muted-foreground">{o.pharmacist?.name ?? '—'}</td>
                <td className="p-3">{o.payCheck}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
                <td className="p-3">{o._count.items}</td>
                <td className="p-3">{formatEGP(Number(o.totalPiastres))}</td>
                <td className="p-3 text-muted-foreground">{o.trackingNumber ?? '—'}</td>
                <td className="p-3 text-end"><Link href={`/admin/orders/${o.id}`} className="text-primary hover:underline">فتح</Link></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">لا توجد طلبات.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
