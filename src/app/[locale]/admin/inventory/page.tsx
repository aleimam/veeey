import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

export default async function InventoryOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const soon = daysFromNow(90);
  const [live, quarantine, expiringSoon, locations] = await Promise.all([
    prisma.lot.count({ where: { status: 'LIVE', qtyOnHand: { gt: 0 } } }),
    prisma.lot.count({ where: { status: 'QUARANTINE' } }),
    prisma.lot.count({ where: { status: 'LIVE', qtyOnHand: { gt: 0 }, expiryDate: { lt: soon } } }),
    prisma.location.count(),
  ]);

  const cards = [
    { label: 'Live lots in stock', value: live, href: '/admin/inventory/lots' },
    { label: 'Pending intake', value: quarantine, href: '/admin/inventory/intake', sub: 'received, awaiting publish' },
    { label: 'Expiring ≤ 90 days', value: expiringSoon, href: '/admin/inventory/lots', sub: 'review for discounts' },
    { label: 'Locations', value: locations, href: '/admin/inventory/locations' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">Inventory</h1>
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
