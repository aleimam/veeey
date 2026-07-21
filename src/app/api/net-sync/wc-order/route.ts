import crypto from 'node:crypto';
import { ingestWpOrder, ingestMode } from '@/lib/net-sync/ingest';

/**
 * Stage 2 — the FAST PATH for ev.net sale ingestion.
 *
 * egyptvitamins.net's WooCommerce posts `order.created` / `order.updated` here,
 * which is what shrinks the window in which veeey.net could resell a unit ev.net
 * has already sold — seconds instead of a poll interval. The
 * `run-ingest.ts` cron is the backstop; both go through the same idempotent
 * path, so overlap is free.
 *
 * Deliberately SEPARATE from /api/integration/woocommerce/webhook: that one
 * serves the veeey.com ↔ egyptvitamins.com pair and drives a catalog sync. This
 * is a different WP peer, a different secret and a different purpose — sharing
 * a route would mean one misconfiguration crosses the two stores' stock.
 *
 * Node runtime: needs crypto + Prisma.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const secret = () => (process.env.NET_SYNC_WC_WEBHOOK_SECRET ?? '').trim();

export async function POST(req: Request): Promise<Response> {
  // Inert unless this deployment is actually ingesting — on veeey.com, which has
  // no WP peer, the endpoint simply doesn't exist.
  if (ingestMode() === 'off') return new Response('not found', { status: 404 });

  const key = secret();
  if (!key) return new Response('webhook not configured', { status: 503 });

  const raw = await req.text();
  const sig = req.headers.get('x-wc-webhook-signature') ?? '';
  const expected = crypto.createHmac('sha256', key).update(raw, 'utf8').digest('base64');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new Response('invalid signature', { status: 401 });

  const topic = (req.headers.get('x-wc-webhook-topic') ?? '').toLowerCase();
  if (!topic.startsWith('order')) return new Response('ignored', { status: 200 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  const o = (body ?? {}) as { id?: unknown; number?: unknown; status?: unknown; line_items?: unknown };
  const wpOrderId = Number(o.id);
  if (!Number.isInteger(wpOrderId) || wpOrderId <= 0) return new Response('no order id', { status: 400 });

  const lines = (Array.isArray(o.line_items) ? o.line_items : []).map((l) => {
    const li = (l ?? {}) as { product_id?: unknown; quantity?: unknown };
    return { wpId: Number(li.product_id) || null, qty: Number(li.quantity) || 0 };
  });

  const r = await ingestWpOrder({
    wpOrderId,
    orderNumber: typeof o.number === 'string' ? o.number : String(wpOrderId),
    status: typeof o.status === 'string' ? o.status : null,
    lines,
  });

  // Always 200 on a verified, well-formed event: a non-2xx makes Woo retry, and
  // "this status moves no stock" is a correct outcome, not a failure.
  return Response.json({ ok: true, ...r });
}
