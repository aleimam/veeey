/**
 * net-sync order history — WP (HPOS) orders → Veeey Order/OrderItem (sync #2).
 * Read-only on WP; idempotent on Order.legacyWpId (existing rows are SKIPPED —
 * history is a snapshot, not a live mirror; WP stays the master via stock sync).
 *
 * Deliberately BYPASSES transitionOrder: no status effects, no loyalty credit,
 * no notifications, no NetStockOutbox writeback — these are historical records.
 * Lifetime spend/tiers already come from the hourly customer sync reading the
 * same WP orders, so totals agree by construction. Status/payment codes resolve
 * through the SAME alias machinery the veeey.com WC import used
 * (OrderStatusConfig.sourceAliases / SystemPaymentMethod aliases).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { prisma } from '@/lib/prisma';
import { resolveImportStatus, customerStatusOf } from '@/lib/order-status-service';
import { resolveImportPayment } from '@/lib/payment-method-service';
import { egpToPiastres } from '@/lib/format';

const PREFIX = process.env.NET_SYNC_WP_PREFIX || 'SFPgx_';
const T = (n: string) => `\`${PREFIX}${n}\``;
type Row = RowDataPacket & Record<string, unknown>;

const chunk = <T>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export type RawOrder = {
  wpId: number;
  status: string; // raw wc-… status
  totalEgp: number;
  shippingEgp: number;
  customerWpId: number; // 0 = guest
  billingEmail: string | null;
  paymentMethod: string | null;
  createdAt: Date;
  items: { productWpId: number; qty: number; grossEgp: number }[];
};

/**
 * WP orders (any status — history) with their line items.
 *
 * `updatedSince` bounds it for the Stage-2 ingest poller, which runs every few
 * minutes and must not full-scan the orders table each time. It filters on
 * date_updated_gmt, NOT created: a cancellation or refund days later is exactly
 * the movement we must not miss, and it never changes the created date.
 */
export async function readOrders(pool: Pool, opts: { updatedSince?: Date } = {}): Promise<RawOrder[]> {
  const since = opts.updatedSince;
  const [orders] = await pool.query<Row[]>(
    `SELECT o.id, o.status, o.total_amount AS total, o.customer_id AS cust, o.billing_email AS email,
            o.payment_method AS pay, o.date_created_gmt AS created, COALESCE(st.shipping_total, 0) AS shipping
     FROM ${T('wc_orders')} o
     LEFT JOIN ${T('wc_order_stats')} st ON st.order_id = o.id
     WHERE o.type = 'shop_order'${since ? ' AND COALESCE(o.date_updated_gmt, o.date_created_gmt) >= ?' : ''}`,
    since ? [since] : [],
  );
  const byId = new Map<number, RawOrder>();
  for (const o of orders) {
    byId.set(Number(o.id), {
      wpId: Number(o.id), status: String(o.status ?? ''), totalEgp: Number(o.total ?? 0), shippingEgp: Number(o.shipping ?? 0),
      customerWpId: Number(o.cust ?? 0), billingEmail: o.email ? String(o.email) : null,
      paymentMethod: o.pay ? String(o.pay) : null, createdAt: new Date(String(o.created)), items: [],
    });
  }
  const ids = [...byId.keys()];
  for (const part of chunk(ids, 5000)) {
    const [items] = await pool.query<Row[]>(
      `SELECT order_id AS oid, product_id AS pid, product_qty AS qty, product_gross_revenue AS gross
       FROM ${T('wc_order_product_lookup')} WHERE order_id IN (${part.map(() => '?').join(',')})`,
      part,
    );
    for (const it of items) {
      byId.get(Number(it.oid))?.items.push({ productWpId: Number(it.pid), qty: Math.max(1, Number(it.qty) || 1), grossEgp: Number(it.gross ?? 0) });
    }
  }
  return [...byId.values()];
}

export type OrdersSummary = {
  source: number; created: number; skippedExisting: number;
  itemsCreated: number; itemsUnmatched: number; guests: number; linkedCustomers: number;
  byStatus: Record<string, number>; errors: { wpId: number; detail: string }[];
};

export async function importOrders(pool: Pool, opts: { dryRun: boolean; onProgress?: (n: number, total: number) => void }): Promise<OrdersSummary> {
  const s: OrdersSummary = { source: 0, created: 0, skippedExisting: 0, itemsCreated: 0, itemsUnmatched: 0, guests: 0, linkedCustomers: 0, byStatus: {}, errors: [] };
  const raws = await readOrders(pool);
  s.source = raws.length;

  // Preloads: existing imported orders, customer + product id maps.
  const existing = new Set((await prisma.order.findMany({ where: { legacyWpId: { not: null } }, select: { legacyWpId: true } })).map((o) => o.legacyWpId!));
  const custByWp = new Map((await prisma.customer.findMany({ where: { legacyWpId: { not: null } }, select: { id: true, legacyWpId: true } })).map((c) => [c.legacyWpId!, c.id]));
  const prodByWp = new Map((await prisma.product.findMany({ where: { legacyWpId: { not: null } }, select: { id: true, legacyWpId: true } })).map((p) => [p.legacyWpId!, p.id]));

  // Status/payment alias resolution is config-backed — cache per raw value.
  const statusCache = new Map<string, { status: string; customerStatus: string | null }>();
  const payCache = new Map<string, { systemCode: string | null; customerCode: string | null }>();

  let i = 0;
  for (const r of raws) {
    try {
      if (existing.has(r.wpId)) { s.skippedExisting++; continue; }

      let st = statusCache.get(r.status);
      if (!st) {
        const code = (await resolveImportStatus(r.status)) ?? 'CONFIRMED';
        st = { status: code, customerStatus: await customerStatusOf(code) };
        statusCache.set(r.status, st);
      }
      let pay = payCache.get(r.paymentMethod ?? '');
      if (!pay) {
        pay = await resolveImportPayment(r.paymentMethod ?? '');
        payCache.set(r.paymentMethod ?? '', pay);
      }

      const total = egpToPiastres(Math.max(0, r.totalEgp));
      const shipping = egpToPiastres(Math.max(0, Math.min(r.shippingEgp, r.totalEgp)));
      const customerId = r.customerWpId > 0 ? custByWp.get(r.customerWpId) ?? null : null;

      if (!opts.dryRun) {
        const created = await prisma.order.create({
          data: {
            number: `EV-${r.wpId}`,
            legacyWpId: r.wpId,
            status: st.status,
            customerStatus: st.customerStatus ?? st.status,
            legacyStatus: r.status || null,
            paymentMethod: pay.customerCode ?? 'COD',
            systemPaymentMethod: pay.systemCode,
            legacyPaymentMethod: r.paymentMethod,
            paymentState: st.status === 'DELIVERED' ? 'PAID' : 'PENDING',
            subtotalPiastres: total - shipping,
            shippingPiastres: shipping,
            discountPiastres: 0n,
            totalPiastres: total,
            customerId,
            guestEmail: customerId ? null : r.billingEmail,
            placedAt: r.createdAt,
            syncedAt: new Date(),
          },
          select: { id: true },
        });
        for (const it of r.items) {
          const productId = prodByWp.get(it.productWpId);
          if (!productId) { s.itemsUnmatched++; continue; }
          await prisma.orderItem.create({
            data: { orderId: created.id, productId, qty: it.qty, unitPricePiastres: egpToPiastres(Math.max(0, it.grossEgp / it.qty)) },
          });
          s.itemsCreated++;
        }
      } else {
        for (const it of r.items) {
          if (prodByWp.has(it.productWpId)) s.itemsCreated++;
          else s.itemsUnmatched++;
        }
      }
      s.created++;
      if (customerId) s.linkedCustomers++; else s.guests++;
      s.byStatus[st.status] = (s.byStatus[st.status] ?? 0) + 1;
    } catch (e) {
      s.errors.push({ wpId: r.wpId, detail: e instanceof Error ? e.message : String(e) });
    }
    if (++i % 1000 === 0) opts.onProgress?.(i, raws.length);
  }
  opts.onProgress?.(raws.length, raws.length);
  return s;
}
