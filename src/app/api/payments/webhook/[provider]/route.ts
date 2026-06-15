import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { getKashierConfig, getOpayConfig, markOrderPaid, opayQueryStatus } from '@/lib/payment-gateways';
import { kashierWebhookSigned, opayVerify } from '@/lib/payment-crypto';

/**
 * Payment gateway webhooks (FR-PAY-03). Confirms payment server-side and flips the
 * order's paymentState — only ever on a verified signal:
 *  - Kashier: HMAC-SHA256 over the webhook's `signatureKeys` fields (API key).
 *  - OPay: authoritative re-query of payment status (HMAC-SHA512), with the
 *    callback `sha512` as a fallback signal.
 * Unverified payloads are logged and rejected (never mark an order paid).
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await req.text();
  try {
    if (provider === 'kashier') return await handleKashier(req, raw);
    if (provider === 'opay') return await handleOpay(raw);
  } catch (e) {
    console.error('payment webhook error', provider, e);
  }
  return NextResponse.json({ received: true, provider });
}

async function handleKashier(req: Request, raw: string) {
  const cfg = await getKashierConfig();
  const body = JSON.parse(raw) as { data?: Record<string, unknown> } & Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;
  // signature may sit in the body or a header; surface it for the verifier
  if (typeof data.signature !== 'string') {
    const hdr = req.headers.get('x-kashier-signature');
    if (hdr) data.signature = hdr;
  }
  const number = String(data.merchantOrderId ?? data.orderReference ?? data.orderId ?? '');
  const status = String(data.status ?? data.paymentStatus ?? '').toUpperCase();
  // Verify with the API key, then the secret key (Kashier terminology overlaps).
  const verified = !!cfg && (kashierWebhookSigned(data, cfg.apiKey) || kashierWebhookSigned(data, cfg.secretKey));
  if (verified && number) {
    await markOrderPaid(number, 'kashier', status === 'SUCCESS' || status === 'PAID');
  } else {
    await audit({ actorType: 'SYSTEM', action: 'payment.webhook.reject', entityType: 'Order', data: { provider: 'kashier', number, verified } });
  }
  return NextResponse.json({ received: true });
}

async function handleOpay(raw: string) {
  const cfg = await getOpayConfig();
  const body = JSON.parse(raw) as { payload?: Record<string, unknown>; sha512?: string } & Record<string, unknown>;
  const payload = (body.payload ?? body) as Record<string, unknown>;
  const reference = String(payload.reference ?? '');
  if (!reference || !cfg) return NextResponse.json({ received: true });

  // Authoritative: re-query OPay for the real status.
  const status = await opayQueryStatus(reference);
  if (status) {
    await markOrderPaid(reference, 'opay', status === 'SUCCESS');
    return NextResponse.json({ received: true });
  }
  // Fallback: trust the callback only if its sha512 verifies.
  if (body.sha512 && opayVerify(JSON.stringify(payload), body.sha512, cfg.privateKey)) {
    await markOrderPaid(reference, 'opay', String(payload.status ?? '').toUpperCase() === 'SUCCESS');
  } else {
    await audit({ actorType: 'SYSTEM', action: 'payment.webhook.reject', entityType: 'Order', data: { provider: 'opay', number: reference, verified: false } });
  }
  return NextResponse.json({ received: true });
}
