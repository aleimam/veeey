import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { dayRangeFilter } from '@/lib/date-filter';

/** Excel/CSV export (FR-ORD-11). CSV opens directly in Excel; selectable date
 *  range. Columns mirror the admin order list. */

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export async function exportOrdersCsv(opts: { from?: string; to?: string } = {}): Promise<string> {
  await requirePermission('orders.read');
  // Shared day-range helper — the export used to cut `to` off at midnight while
  // the list ran to end-of-day, so CSVs silently dropped the final day.
  const placedAt = dayRangeFilter(opts.from, opts.to);
  const orders = await prisma.order.findMany({
    where: {
      ...(placedAt ? { placedAt } : {}),
    },
    include: { customer: { include: { user: { select: { email: true } } } }, pharmacist: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { placedAt: 'desc' },
    take: 5000,
  });

  const header = ['Number', 'Date', 'Customer', 'Status', 'Payment', 'Total EGP', 'Items', 'Pharmacist', 'Tracking', 'Source'];
  const rows = orders.map((o) => [
    o.number,
    o.placedAt.toISOString().slice(0, 10),
    o.customer?.user.email ?? o.guestEmail ?? '',
    o.status,
    o.paymentMethod ?? '',
    (Number(o.totalPiastres) / 100).toFixed(2),
    o._count.items,
    o.pharmacist?.name ?? '',
    o.trackingNumber ?? '',
    o.source ?? '',
  ]);
  return toCsv([header, ...rows]);
}
