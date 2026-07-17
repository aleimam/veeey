import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings-service';
import { collectionRuleWhere } from '@/lib/content-service';
import {
  reorderTabs,
  suggestedReorderQty,
  type ReorderInput,
  type ReorderTab,
} from '@/lib/inventory-reorder';

/**
 * DB layer for the Inventory "Requests (To-buy)" feature (INV-P3). Aggregates
 * per-product sales windows + sellable stock, resolves Best-Sellers membership
 * for the featured flag, applies the ignore list, and classifies every
 * PUBLISHED product into the To-buy tabs via the pure engine (inventory-reorder).
 *
 * Sales = OrderItem.qty by Order.placedAt, excluding cancelled/refunded orders
 * and LOST lines, INCLUDING pre-order demand. Stock = Σ(qtyOnHand − qtyReserved)
 * over LIVE, NEW lots across all locations. "Incoming" / real "requested" counts
 * arrive from YeldnIN later; until then requested = local pending PurchaseRequests.
 */

export type ReorderTabKey = ReorderTab | 'ignored';

export interface ReorderRow {
  productId: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  image: string | null;
  stock: number;
  units30: number;
  units90: number;
  units180: number;
  featured: boolean;
  preorderUnits: number;
  requestedUnits: number; // local pending PurchaseRequests (YeldnIN number arrives later)
  incomingUnits: number | null; // purchased-not-received — from YeldnIN, null until wired
  suggestedQty: number;
  ignoredUntil: Date | null;
}

export interface ReorderView {
  rows: ReorderRow[];
  total: number;
  page: number;
  perPage: number;
  counts: Record<ReorderTabKey, number>;
}

type Sales = { u7: number; u30: number; u90: number; u180: number; w6: number; m6: number };
type Meta = Sales & {
  stock: number;
  featured: boolean;
  preorderUnits: number;
  requestedUnits: number;
  suggestedQty: number;
  ignoredUntil: Date | null;
};

const n = (v: bigint | number | null): number => (v == null ? 0 : Number(v));

/** Sellable stock per product: Σ(qtyOnHand − qtyReserved) over LIVE, NEW lots. */
async function stockByProduct(): Promise<Map<string, number>> {
  const rows = await prisma.lot.groupBy({
    by: ['productId'],
    where: { status: 'LIVE', condition: 'NEW' },
    _sum: { qtyOnHand: true, qtyReserved: true },
  });
  return new Map(rows.map((r) => [r.productId, (r._sum.qtyOnHand ?? 0) - (r._sum.qtyReserved ?? 0)]));
}

/** Per-product unit sales across the windows the tabs need (last 210 days). */
async function salesByProduct(): Promise<Map<string, Sales>> {
  const rows = await prisma.$queryRaw<
    Array<{ productId: string; u7: bigint | null; u30: bigint | null; u90: bigint | null; u180: bigint | null; w6: bigint | null; m6: bigint | null }>
  >`
    SELECT oi."productId" AS "productId",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '7 days')  AS "u7",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '30 days') AS "u30",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '90 days') AS "u90",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '180 days') AS "u180",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '49 days'  AND o."placedAt" < now() - interval '7 days')  AS "w6",
      SUM(oi.qty) FILTER (WHERE o."placedAt" >= now() - interval '210 days' AND o."placedAt" < now() - interval '30 days') AS "m6"
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE oi.lost = false
      AND o."placedAt" >= now() - interval '210 days'
      AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY oi."productId"
  `;
  return new Map(rows.map((r) => [r.productId, { u7: n(r.u7), u30: n(r.u30), u90: n(r.u90), u180: n(r.u180), w6: n(r.w6), m6: n(r.m6) }]));
}

/** Open (still-awaiting-stock) pre-order demand per product — drives Special orders. */
async function preorderByProduct(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ productId: string; units: bigint | null }>>`
    SELECT oi."productId" AS "productId", SUM(oi.qty) AS "units"
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE oi.preorder = true AND oi."lotId" IS NULL AND oi.lost = false
      AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY oi."productId"
  `;
  return new Map(rows.map((r) => [r.productId, n(r.units)]));
}

/** Product ids in the admin-configured featured collection (default best-sellers). */
async function featuredProductIds(): Promise<Set<string>> {
  const slug = (await getSetting('inventory.featuredCollectionSlug')).trim();
  if (!slug) return new Set();
  const coll = await prisma.collection.findFirst({
    where: { slug },
    select: { id: true, type: true, ruleJson: true, ruleCategoryId: true, ruleTagSlug: true },
  });
  if (!coll) return new Set();
  if (coll.type === 'MANUAL') {
    const withProducts = await prisma.collection.findUnique({
      where: { id: coll.id },
      select: { products: { where: { status: 'PUBLISHED' }, select: { id: true } } },
    });
    return new Set((withProducts?.products ?? []).map((p) => p.id));
  }
  const ids = await prisma.product.findMany({ where: { status: 'PUBLISHED', ...collectionRuleWhere(coll) }, select: { id: true } });
  return new Set(ids.map((p) => p.id));
}

/**
 * Open requested units per product, summed by qty. The Request model (A5)
 * supersedes the flat PurchaseRequest, but any legacy pending PurchaseRequest is
 * still counted so nothing in flight is lost. New Requests contribute their open
 * (not archived, PENDING/APPROVED) line counts.
 */
async function pendingRequestsByProduct(): Promise<Map<string, number>> {
  const [legacy, lines] = await Promise.all([
    prisma.purchaseRequest.groupBy({
      by: ['productId'],
      where: { status: { in: ['PENDING', 'SENT'] } },
      _sum: { qtyRequested: true },
    }),
    prisma.requestLine.groupBy({
      by: ['productId'],
      where: { request: { archivedAt: null, status: { in: ['PENDING', 'APPROVED'] } } },
      _sum: { count: true },
    }),
  ]);
  const map = new Map<string, number>();
  for (const r of legacy) map.set(r.productId, r._sum.qtyRequested ?? 0);
  for (const l of lines) map.set(l.productId, (map.get(l.productId) ?? 0) + (l._sum.count ?? 0));
  return map;
}

/** True while an ignore suppresses a product: snooze still active AND stock hasn't risen above the ignored level. */
function isSuppressed(ig: { snoozeUntil: Date | null; stockAtIgnore: number | null }, stock: number, now: number): boolean {
  const snoozeActive = ig.snoozeUntil == null || ig.snoozeUntil.getTime() > now;
  const stockRose = ig.stockAtIgnore != null && stock > ig.stockAtIgnore;
  return snoozeActive && !stockRose;
}

/**
 * Classify every PUBLISHED product into the To-buy tabs, apply the ignore list,
 * then sort + paginate the requested tab. Counts cover all tabs (for the badges).
 */
export async function getReorderView(opts: { tab: ReorderTabKey; page: number; perPage: number }): Promise<ReorderView> {
  const now = Date.now();
  const [published, stockMap, salesMap, preMap, featured, pendingMap, ignores] = await Promise.all([
    prisma.product.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, reorderPoint: true } }),
    stockByProduct(),
    salesByProduct(),
    preorderByProduct(),
    featuredProductIds(),
    pendingRequestsByProduct(),
    prisma.reorderIgnore.findMany({ select: { productId: true, snoozeUntil: true, stockAtIgnore: true } }),
  ]);
  const ignoreMap = new Map(ignores.map((i) => [i.productId, i]));

  const perTab: Record<ReorderTabKey, string[]> = {
    out_of_stock: [], last_piece: [], short_stock: [], running_fast: [], special_orders: [], ignored: [],
  };
  const meta = new Map<string, Meta>();
  const zero: Sales = { u7: 0, u30: 0, u90: 0, u180: 0, w6: 0, m6: 0 };

  for (const { id, reorderPoint } of published) {
    const stock = stockMap.get(id) ?? 0;
    const s = salesMap.get(id) ?? zero;
    const isFeatured = featured.has(id);
    const preorderUnits = preMap.get(id) ?? 0;
    const requestedUnits = pendingMap.get(id) ?? 0;
    const suggestedQty = suggestedReorderQty({ units90: s.u90, stock });

    const ig = ignoreMap.get(id);
    if (ig && isSuppressed(ig, stock, now)) {
      perTab.ignored.push(id);
      meta.set(id, { ...s, stock, featured: isFeatured, preorderUnits, requestedUnits, suggestedQty, ignoredUntil: ig.snoozeUntil });
      continue;
    }

    const input: ReorderInput = {
      stock,
      units30: s.u30,
      units90: s.u90,
      units180: s.u180,
      featured: isFeatured,
      weeklyBaseline: [s.w6 / 6],
      units7: s.u7,
      monthlyBaseline: [s.m6 / 6],
      preorderUnits,
      reorderPoint, // manual threshold override (V4 C12)
    };
    const tabs = reorderTabs(input);
    if (tabs.length === 0) continue;
    for (const t of tabs) perTab[t].push(id);
    meta.set(id, { ...s, stock, featured: isFeatured, preorderUnits, requestedUnits, suggestedQty, ignoredUntil: null });
  }

  const counts = Object.fromEntries(Object.entries(perTab).map(([k, v]) => [k, v.length])) as Record<ReorderTabKey, number>;

  // Sort the requested tab: special orders by demand, running-fast by recency, ignored by soonest to resurface, otherwise by reorder urgency.
  const ids = perTab[opts.tab] ?? [];
  const sortKey = (id: string): number => {
    const m = meta.get(id)!;
    if (opts.tab === 'special_orders') return m.preorderUnits;
    if (opts.tab === 'running_fast') return m.u7;
    if (opts.tab === 'ignored') return -(m.ignoredUntil?.getTime() ?? 0);
    return m.suggestedQty;
  };
  const sorted = [...ids].sort((a, b) => sortKey(b) - sortKey(a));
  const total = sorted.length;
  const slice = sorted.slice((opts.page - 1) * opts.perPage, opts.page * opts.perPage);

  const products = slice.length
    ? await prisma.product.findMany({
        where: { id: { in: slice } },
        select: { id: true, sku: true, nameEn: true, nameAr: true, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } } },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  const rows: ReorderRow[] = slice.map((id) => {
    const m = meta.get(id)!;
    const p = byId.get(id);
    return {
      productId: id,
      sku: p?.sku ?? '',
      nameEn: p?.nameEn ?? '(deleted)',
      nameAr: p?.nameAr ?? null,
      image: p?.images[0]?.url ?? null,
      stock: m.stock,
      units30: m.u30,
      units90: m.u90,
      units180: m.u180,
      featured: m.featured,
      preorderUnits: m.preorderUnits,
      requestedUnits: m.requestedUnits,
      incomingUnits: null,
      suggestedQty: m.suggestedQty,
      ignoredUntil: m.ignoredUntil,
    };
  });

  return { rows, total, page: opts.page, perPage: opts.perPage, counts };
}

// ---------------------------------------------------------------------------
// Mutations (called from server actions; RBAC + audit live in the action layer)
// ---------------------------------------------------------------------------

const IGNORE_SNOOZE_DAYS = 30;

/** Current sellable stock for a single product (used when recording an ignore baseline / suggested qty). */
export async function productStock(productId: string): Promise<number> {
  const agg = await prisma.lot.aggregate({
    where: { productId, status: 'LIVE', condition: 'NEW' },
    _sum: { qtyOnHand: true, qtyReserved: true },
  });
  return (agg._sum.qtyOnHand ?? 0) - (agg._sum.qtyReserved ?? 0);
}

/** Snooze a product off the To-buy lists for 30 days (or until stock rises above now). */
export async function ignoreProduct(productId: string, actor: { id: string; name: string | null }, reason?: string): Promise<void> {
  const stock = await productStock(productId);
  const snoozeUntil = new Date(Date.now() + IGNORE_SNOOZE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.reorderIgnore.upsert({
    where: { productId },
    create: { productId, snoozeUntil, stockAtIgnore: stock, reason: reason ?? null, ignoredById: actor.id, ignoredByName: actor.name ?? null },
    update: { snoozeUntil, stockAtIgnore: stock, reason: reason ?? null, ignoredById: actor.id, ignoredByName: actor.name ?? null },
  });
}

/** Restore a product to the To-buy lists. */
export async function unignoreProduct(productId: string): Promise<void> {
  await prisma.reorderIgnore.deleteMany({ where: { productId } });
}

/**
 * Record a reorder request and queue it to the YeldnIN outbox. The OutboxEvent
 * only dispatches once the integration is enabled (INTEGRATION_ENABLED); until
 * then it stays PENDING and the request drives the local "requested" count.
 */
export async function createPurchaseRequest(
  productId: string,
  qty: number,
  actor: { id: string; name: string | null },
  note?: string,
): Promise<string> {
  const { recordOutbox } = await import('@/lib/integration/integration-service');
  const req = await prisma.purchaseRequest.create({
    data: { productId, qtyRequested: qty, status: 'PENDING', note: note ?? null, requestedById: actor.id, requestedByName: actor.name ?? null },
    select: { id: true, productId: true, qtyRequested: true },
  });
  // recordOutbox no-ops (returns null) while the YeldnIN integration is disabled —
  // the request is still captured locally and drives the "requested" count.
  const evt = await recordOutbox('requests.create', req.id, { requestId: req.id, productId: req.productId, qty: req.qtyRequested });
  if (evt) await prisma.purchaseRequest.update({ where: { id: req.id }, data: { outboxEventId: evt.id } });
  return req.id;
}

/** Server-computed suggested reorder qty for a product (used by bulk request). */
export async function suggestedQtyFor(productId: string): Promise<number> {
  const [stock, sales] = await Promise.all([
    productStock(productId),
    prisma.$queryRaw<Array<{ u90: bigint | null }>>`
      SELECT SUM(oi.qty) AS "u90"
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      WHERE oi."productId" = ${productId} AND oi.lost = false
        AND o."placedAt" >= now() - interval '90 days' AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    `,
  ]);
  return suggestedReorderQty({ units90: n(sales[0]?.u90 ?? null), stock });
}
