import 'server-only';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { getSetting } from '@/lib/settings-service';
import { getKashierConfig, getOpayConfig } from '@/lib/provider-config';
import { kashierAmount, kashierOrderHash, opaySignature } from '@/lib/payment-crypto';

/**
 * Online card payment orchestration (FR-PAY-02/03). The storefront card method
 * ("Visa / MasterCard") is fulfilled by whichever gateway the admin configured —
 * Kashier (hosted payment page) or OPay (Cashier). Credentials come from Admin →
 * Providers (provider-config). Hosted-redirect builders here; signature math in
 * payment-crypto; webhooks flip the order's paymentState.
 */
export type CardGateway = 'kashier' | 'opay';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://veeey.com').replace(/\/$/, '');

export type CardOrder = {
  number: string;
  totalPiastres: bigint;
  locale: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** Which gateway backs the card method. Admin setting `payments.cardGateway`
 *  (`auto` | `kashier` | `opay`); `auto` prefers Kashier, then OPay. Returns null
 *  when neither is configured (caller falls back to a pending order). */
export async function resolveCardGateway(): Promise<CardGateway | null> {
  const pref = (await getSetting('payments.cardGateway')).trim().toLowerCase();
  const [k, o] = await Promise.all([getKashierConfig(), getOpayConfig()]);
  if (pref === 'kashier' && k) return 'kashier';
  if (pref === 'opay' && o) return 'opay';
  if (k) return 'kashier';
  if (o) return 'opay';
  return null;
}

function returnUrl(order: CardOrder) {
  return `${SITE_URL}/${order.locale}/checkout/confirmation?order=${encodeURIComponent(order.number)}`;
}

/** Build the hosted-checkout redirect for an order, or null if no gateway is
 *  configured / the gateway call failed (order stays PENDING). */
export async function buildCardRedirect(order: CardOrder): Promise<string | null> {
  const gateway = await resolveCardGateway();
  if (gateway === 'kashier') return buildKashierRedirect(order);
  if (gateway === 'opay') return buildOpayRedirect(order);
  return null;
}

// ---- Kashier ---------------------------------------------------------------
async function buildKashierRedirect(order: CardOrder): Promise<string | null> {
  const cfg = await getKashierConfig();
  if (!cfg) return null;
  const live = cfg.environment === 'live';
  const amount = kashierAmount(order.totalPiastres);
  const hash = kashierOrderHash({ mid: cfg.merchantId, orderId: order.number, amount, currency: 'EGP', apiKey: cfg.apiKey });
  const host = live ? 'iframe.kashier.io' : 'test-iframe.kashier.io';
  const q = new URLSearchParams({
    merchantId: cfg.merchantId,
    orderId: order.number,
    amount,
    currency: 'EGP',
    hash,
    mode: live ? 'live' : 'test',
    merchantRedirect: returnUrl(order),
    allowedMethods: 'card',
    display: order.locale === 'ar' ? 'ar' : 'en',
    redirectMethod: 'get',
  });
  return `https://${host}/?${q.toString()}`;
}

// ---- OPay ------------------------------------------------------------------
async function buildOpayRedirect(order: CardOrder): Promise<string | null> {
  const cfg = await getOpayConfig();
  if (!cfg) return null;
  const live = cfg.environment === 'live';
  const base = live ? 'https://liveapi.opaycheckout.com' : 'https://testapi.opaycheckout.com';
  const body = {
    country: 'EG',
    reference: order.number,
    amount: { total: Number(order.totalPiastres), currency: 'EGP' },
    returnUrl: returnUrl(order),
    callbackUrl: `${SITE_URL}/api/payments/webhook/opay`,
    cancelUrl: `${SITE_URL}/${order.locale}/checkout/confirmation?order=${encodeURIComponent(order.number)}&cancelled=1`,
    expireAt: 30,
    product: { name: `Veeey order ${order.number}`, description: `Veeey order ${order.number}` },
    userInfo: { userId: order.email ?? order.number, userName: order.name ?? 'Customer', userMobile: order.phone ?? '', userEmail: order.email ?? '' },
    customerVisitSource: 'BROWSER',
  };
  try {
    const res = await fetch(`${base}/api/v1/international/cashier/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${cfg.publicKey}`, MerchantId: cfg.merchantId },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { code?: string; data?: { cashierUrl?: string } } | null;
    if (json?.code === '00000' && json.data?.cashierUrl) return json.data.cashierUrl;
    console.error('opay create failed', json?.code, res.status);
    return null;
  } catch (e) {
    console.error('opay create error', e);
    return null;
  }
}

/** Re-query OPay for the authoritative payment status (HMAC-SHA512 auth). Used by
 *  the webhook to confirm before marking an order paid. */
export async function opayQueryStatus(reference: string): Promise<string | null> {
  const cfg = await getOpayConfig();
  if (!cfg) return null;
  const live = cfg.environment === 'live';
  const base = live ? 'https://liveapi.opaycheckout.com' : 'https://testapi.opaycheckout.com';
  const payload = JSON.stringify({ country: 'EG', reference });
  try {
    const res = await fetch(`${base}/api/v1/international/cashier/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${opaySignature(payload, cfg.privateKey)}`, MerchantId: cfg.merchantId },
      body: payload,
    });
    const json = (await res.json().catch(() => null)) as { code?: string; data?: { status?: string } } | null;
    return json?.data?.status ?? null;
  } catch (e) {
    console.error('opay status error', e);
    return null;
  }
}

/** Idempotently flip an order's payment state from a verified gateway signal.
 *  Only transitions out of PENDING/FAILED so we never clobber refunds. */
export async function markOrderPaid(number: string, provider: string, paid: boolean): Promise<void> {
  const order = await prisma.order.findUnique({ where: { number }, select: { id: true, paymentState: true } });
  if (!order) return;
  if (order.paymentState === 'PAID' && paid) return; // already settled — idempotent
  if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentState)) return;
  const state = paid ? 'PAID' : 'FAILED';
  if (order.paymentState === state) return;
  await prisma.order.update({ where: { id: order.id }, data: { paymentState: state } });
  await audit({ actorType: 'SYSTEM', action: 'payment.settle', entityType: 'Order', entityId: order.id, data: { provider, number, state } });
}

export { getKashierConfig, getOpayConfig };
