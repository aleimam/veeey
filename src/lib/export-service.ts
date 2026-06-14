import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';

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
  const orders = await prisma.order.findMany({
    where: {
      ...(opts.from || opts.to
        ? { placedAt: { ...(opts.from ? { gte: new Date(opts.from) } : {}), ...(opts.to ? { lte: new Date(opts.to) } : {}) } }
        : {}),
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
