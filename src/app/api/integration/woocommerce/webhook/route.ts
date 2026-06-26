import crypto from 'node:crypto';
import { getWebhookSecret } from '@/lib/woocommerce';
import { enqueue, QUEUES } from '@/lib/jobs';
import { syncEntity } from '@/lib/migration/wc-sync';

export const dynamic = 'force-dynamic';

/**
 * Inbound WooCommerce webhook (egyptvitamins.com → Veeey). Verifies the
 * HMAC-SHA256 signature (base64) against the admin-set secret, then nudges an
 * incremental sync of the affected entity. Deletes are ignored (we never
 * auto-remove Veeey records). Read-from-source only.
 */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const secret = await getWebhookSecret();
  if (!secret) return new Response('webhook not configured', { status: 503 });

  const sig = req.headers.get('x-wc-webhook-signature') ?? '';
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new Response('invalid signature', { status: 401 });

  const topic = (req.headers.get('x-wc-webhook-topic') ?? '').toLowerCase();
  const entity = topic.startsWith('product') ? 'products' : topic.startsWith('customer') ? 'customers' : topic.startsWith('order') ? 'orders' : null;
  if (!entity) return new Response('ignored', { status: 200 });
  if (topic.endsWith('.deleted')) return new Response('delete ignored', { status: 200 });

  // Offload to the worker if running; otherwise run inline. Bounded — the cursor
  // makes this pick up just the changed record(s).
  await enqueue(QUEUES.wooSync, { entity }, async () => {
    await syncEntity(entity, { maxPages: 1 });
  });
  return new Response('ok', { status: 200 });
}
