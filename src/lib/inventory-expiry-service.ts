import { prisma } from '@/lib/prisma';
import { expiryTabs, shortestExpiries, type ExpiryTab } from '@/lib/inventory-reorder';

/**
 * DB layer for the Inventory "Expiry Fight (To-sell)" feature (INV-P4). Lists
 * products with LIVE, in-stock, dated lots approaching expiry, grouped into the
 * 5 expiry windows. A product appears in a tab when its SOONEST-expiring lot
 * falls in that window (windows are cumulative). Each row surfaces the product's
 * 3 nearest-expiry lots (expiry + stock + price) and its 30/90/180-day sales so
 * staff can mark expiring lots down fast.
 */

export interface ExpiryLotRow {
  lotId: string;
  expiry: Date;
  daysToExpiry: number;
  stock: number; // physical on hand
  pricePiastres: number; // effective per-lot price (override or product base)
  onSale: boolean;
  condition: string;
}

export interface ExpiryRow {
  productId: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  image: string | null;
  lots: ExpiryLotRow[]; // shortest 3
  units30: number;
  units90: number;
  units180: number;
}

export interface ExpiryView {
  rows: ExpiryRow[];
  total: number;
  page: number;
  perPage: number;
  counts: Record<ExpiryTab, number>;
}

const DAY = 24 * 60 * 60 * 1000;
const n = (v: bigint | number | null) => (v == null ? 0 : Number(v));

async function salesFor(ids: string[]): Promise<Map<string, { u30: number; u90: number; u180: number }>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Array<{ productId: string; u30: bigint | null; u90: bigint | null; u180: bigint | null }>>`
    SELECT oi."productId" AS "productId",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '30 days')  AS "u30",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '90 days')  AS "u90",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '180 days') AS "u180"
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
    WHERE oi.lost = false AND o.status NOT IN ('CANCELLED', 'REFUNDED') AND oi."productId" = ANY(${ids})
    GROUP BY oi."productId"
  `;
  return new Map(rows.map((r) => [r.productId, { u30: n(r.u30), u90: n(r.u90), u180: n(r.u180) }]));
}

export async function getExpiryView(opts: { tab: ExpiryTab; page: number; perPage: number }): Promise<ExpiryView> {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0); // include lots expiring today
  const horizonEnd = new Date(now.getTime() + 365 * DAY);

  const lots = await prisma.lot.findMany({
    where: { status: 'LIVE', qtyOnHand: { gt: 0 }, expiryDate: { gte: now, lt: horizonEnd } },
    select: {
      id: true, productId: true, expiryDate: true, qtyOnHand: true, saleFlag: true, condition: true, priceOverridePiastres: true,
      product: { select: { basePricePiastres: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });

  const byProduct = new Map<string, typeof lots>();
  for (const l of lots) {
    const arr = byProduct.get(l.productId) ?? [];
    arr.push(l);
    byProduct.set(l.productId, arr);
  }

  const perTab: Record<ExpiryTab, string[]> = { this_month: [], next_month: [], quarter: [], bi_annual: [], year: [] };
  const nearest = new Map<string, number>();
  for (const [pid, plots] of byProduct) {
    const soonest = plots[0].expiryDate!; // lots sorted ascending
    nearest.set(pid, soonest.getTime());
    for (const t of expiryTabs(soonest, now)) perTab[t].push(pid);
  }
  const counts = Object.fromEntries(Object.entries(perTab).map(([k, v]) => [k, v.length])) as Record<ExpiryTab, number>;

  const ids = perTab[opts.tab] ?? [];
  const sorted = [...ids].sort((a, b) => nearest.get(a)! - nearest.get(b)!); // soonest expiry first
  const total = sorted.length;
  const slice = sorted.slice((opts.page - 1) * opts.perPage, opts.page * opts.perPage);

  const [salesMap, products] = await Promise.all([
    salesFor(slice),
    slice.length
      ? prisma.product.findMany({
          where: { id: { in: slice } },
          select: { id: true, sku: true, nameEn: true, nameAr: true, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } } },
        })
      : Promise.resolve([]),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const rows: ExpiryRow[] = slice.map((pid) => {
    const p = byId.get(pid);
    const plots = byProduct.get(pid)!;
    const short3 = shortestExpiries(plots.map((l) => ({ ...l, expiry: l.expiryDate! })), 3);
    const s = salesMap.get(pid) ?? { u30: 0, u90: 0, u180: 0 };
    return {
      productId: pid,
      sku: p?.sku ?? '',
      nameEn: p?.nameEn ?? '(deleted)',
      nameAr: p?.nameAr ?? null,
      image: p?.images[0]?.url ?? null,
      lots: short3.map((l) => ({
        lotId: l.id,
        expiry: l.expiry,
        daysToExpiry: Math.ceil((l.expiry.getTime() - now.getTime()) / DAY),
        stock: l.qtyOnHand,
        pricePiastres: n(l.priceOverridePiastres ?? l.product.basePricePiastres),
        onSale: l.saleFlag,
        condition: l.condition,
      })),
      units30: s.u30,
      units90: s.u90,
      units180: s.u180,
    };
  });

  return { rows, total, page: opts.page, perPage: opts.perPage, counts };
}

// ---- Expired stock (V4 C6) --------------------------------------------------

export interface ExpiredStockRow {
  lotId: string;
  productId: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  image: string | null;
  expiry: Date | null;
  qty: number;
  valuePiastres: number; // qty × effective price (what the stuck stock is "worth")
  condition: string;
}

/** EXPIRED lots still holding units — the write-off/disposal queue. Auto-expiry
 *  (expireOverdueLots) feeds this; sorted most-recently-expired first. */
export async function getExpiredStock(limit = 100): Promise<{ rows: ExpiredStockRow[]; totalLots: number; totalUnits: number; totalValuePiastres: number }> {
  const lots = await prisma.lot.findMany({
    where: { status: 'EXPIRED', qtyOnHand: { gt: 0 } },
    select: {
      id: true, productId: true, expiryDate: true, qtyOnHand: true, condition: true, priceOverridePiastres: true,
      product: { select: { sku: true, nameEn: true, nameAr: true, basePricePiastres: true, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } } } },
    },
    orderBy: [{ expiryDate: 'desc' }],
  });

  let totalUnits = 0;
  let totalValuePiastres = 0;
  const all = lots.map((l) => {
    const value = l.qtyOnHand * n(l.priceOverridePiastres ?? l.product.basePricePiastres);
    totalUnits += l.qtyOnHand;
    totalValuePiastres += value;
    return {
      lotId: l.id,
      productId: l.productId,
      sku: l.product.sku,
      nameEn: l.product.nameEn,
      nameAr: l.product.nameAr,
      image: l.product.images[0]?.url ?? null,
      expiry: l.expiryDate,
      qty: l.qtyOnHand,
      valuePiastres: value,
      condition: l.condition,
    };
  });

  return { rows: all.slice(0, limit), totalLots: all.length, totalUnits, totalValuePiastres };
}
