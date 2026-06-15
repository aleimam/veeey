import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { pick } from '@/lib/admin-i18n';

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

export default async function InventoryOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  const soon = daysFromNow(90);
  const [live, quarantine, expiringSoon, locations] = await Promise.all([
    prisma.lot.count({ where: { status: 'LIVE', qtyOnHand: { gt: 0 } } }),
    prisma.lot.count({ where: { status: 'QUARANTINE' } }),
    prisma.lot.count({ where: { status: 'LIVE', qtyOnHand: { gt: 0 }, expiryDate: { lt: soon } } }),
    prisma.location.count(),
  ]);

  const cards = [
    { label: tb('Lots in stock', 'الدفعات المتاحة في المخزون'), value: live, href: '/admin/inventory/lots' },
    { label: tb('Pending intake', 'إدخال قيد الانتظار'), value: quarantine, href: '/admin/inventory/intake', sub: tb('Received, awaiting publish', 'تم الاستلام، في انتظار النشر') },
    { label: tb('Expiring within ≤ 90 days', 'تنتهي صلاحيتها خلال ≤ 90 يوم'), value: expiringSoon, href: '/admin/inventory/lots', sub: tb('Review for discounts', 'مراجعة للخصومات') },
    { label: tb('Locations', 'المواقع'), value: locations, href: '/admin/inventory/locations' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tb('Inventory', 'المخزون')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg border border-border bg-card p-5 transition hover:border-primary">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-3xl font-semibold text-foreground">{c.value}</div>
            {c.sub && <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
