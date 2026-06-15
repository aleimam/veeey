import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listSpecialOrders } from '@/lib/special-order-service';
import { StatusBadge } from '@/components/admin/ui';

export default async function SpecialOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const items = await listSpecialOrders();

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">Special orders ({items.length})</h1>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">Requester</th>
              <th className="p-3 text-start">Product</th>
              <th className="p-3 text-start">Status</th>
              <th className="p-3 text-start">Deadline</th>
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
                <td className="p-3 text-end"><Link href={`/admin/special-orders/${s.id}`} className="text-primary hover:underline">Manage</Link></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No special orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
