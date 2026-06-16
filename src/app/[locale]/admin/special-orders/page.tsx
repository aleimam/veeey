import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listSpecialOrders } from '@/lib/special-order-service';
import { StatusBadge } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export default async function SpecialOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const items = await listSpecialOrders();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Special orders', 'الطلبات الخاصة')} ({items.length})</h1>
        <Link href="/admin/special-orders/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Create special order', 'إنشاء طلب خاص')}</Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Requester', 'مقدّم الطلب')}</th>
              <th className="p-3 text-start">{tb('Product', 'المنتج')}</th>
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
              <th className="p-3 text-start">{tb('Deadline', 'الموعد النهائي')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-border">
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
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{tb('No special orders yet.', 'لا توجد طلبات خاصة بعد.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
