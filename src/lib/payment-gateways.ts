import 'server-only';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { getSetting } from '@/lib/settings-service';
import { getKashierConfig, getOpayConfig } from '@/lib/provider-config';
import { kashierAmount, opaySignature, opayBaseUrl } from '@/lib/payment-crypto';

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

/** Which gateway backs the card method. The customer's explicit choice
 *  (CARD_OPAY / CARD_KASHIER → `prefer`) wins when that gateway is configured;
 *  otherwise the admin setting `payments.cardGateway` (`auto` | `kashier` |
 *  `opay`) applies, with `auto` preferring Kashier then OPay. Returns null when
 *  neither is configured (caller falls back to a pending order). */
export async function resolveCardGateway(prefer?: CardGateway | null): Promise<CardGateway | null> {
  const [k, o] = await Promise.all([getKashierConfig(), getOpayConfig()]);
  if (prefer === 'kashier' && k) return 'kashier';
  if (prefer === 'opay' && o) return 'opay';
  const pref = (await getSetting('payments.cardGateway')).trim().toLowerCase();
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
export async function buildCardRedirect(order: CardOrder, prefer?: CardGateway | null): Promise<string | null> {
  const gateway = await resolveCardGateway(prefer);
  if (gateway === 'kashier') return buildKashierRedirect(order);
  if (gateway === 'opay') return buildOpayRedirect(order);
  return null;
}

// ---- Kashier ---------------------------------------------------------------

/** Where Kashier posts the server-to-server payment notification. */
export const kashierWebhookUrl = () => `${SITE_URL}/api/payments/webhook/kashier`;

/**
 * Kashier **Payment Sessions v3**: POST the order server-side, redirect the
 * customer to the returned `sessionUrl`.
 *
 * Replaces the old `iframe.kashier.io/?merchantId=…&hash=…` redirect for two
 * reasons. The decisive one: that flow has **no way to pass `serverWebhook`**,
 * so Kashier had no address to notify — the customer paid, saw the confirmation
 * page, and the order never left PENDING. Silent, and only visible by
 * reconciling takings against orders. The second: it put the merchant id, amount
 * and hash in a URL the customer can read and edit.
 *
 * Auth uses BOTH credentials, which is the same split that made the connection
 * check fail: `Authorization` is the SECRET key, `api-key` is the API key.
 *
 * Returns null on any failure so the caller falls back to a pending order rather
 * than sending a customer to a broken page.
 */
async function buildKashierRedirect(order: CardOrder): Promise<string | null> {
  const cfg = await getKashierConfig();
  if (!cfg) return null;
  const live = cfg.environment === 'live';
  const base = live ? 'https://api.kashier.io' : 'https://test-api.kashier.io';

  // v3 validates STRICTLY: an undocumented field is a 400, not an ignored extra.
  // Verified field-by-field against the test endpoint — the parameter table is
  // wrong in three places. It calls this `orderId` ("orderId is not allowed"),
  // lists `mode` as required ("mode is not allowed" — the environment is chosen
  // by the HOST, test-api vs api), and marks `customer` optional though the API
  // rejects a request without it.
  const body = {
    order: order.number,
    merchantId: cfg.merchantId,
    amount: kashierAmount(order.totalPiastres),
    currency: 'EGP',
    type: 'one-time',
    paymentType: 'credit',
    allowedMethods: 'card',
    display: order.locale === 'ar' ? 'ar' : 'en',
    merchantRedirect: returnUrl(order),
    serverWebhook: kashierWebhookUrl(),
    // A session that never expires is a payment link that stays live forever.
    expireAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    maxFailureAttempts: 3,
    description: `Veeey order ${order.number}`.slice(0, 119),
    // ALWAYS sent. Kashier's parameter table marks `customer` optional; the v3
    // API rejects the request without it ("customer is required"), verified
    // against the test endpoint. `reference` is what links our order to their
    // payment record, so it matters even for a guest with no email.
    customer: { reference: order.number, ...(order.email ? { email: order.email } : {}) },
  };

  try {
    const res = await fetch(`${base}/v3/payment/sessions`, {
      method: 'POST',
      headers: {
        Authorization: cfg.secretKey,
        'api-key': cfg.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      redirect: 'manual', // a redirect here would hand back HTML as "the session"
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      await audit({ actorType: 'SYSTEM', action: 'payment.session.fail', entityType: 'Order', entityId: order.number, data: { provider: 'kashier', status: res.status, detail: text.slice(0, 300) } });
      return null;
    }
    const json = JSON.parse(text) as { sessionUrl?: string };
    if (!json.sessionUrl) {
      await audit({ actorType: 'SYSTEM', action: 'payment.session.fail', entityType: 'Order', entityId: order.number, data: { provider: 'kashier', detail: 'no sessionUrl in response' } });
      return null;
    }
    return json.sessionUrl;
  } catch (e) {
    await audit({ actorType: 'SYSTEM', action: 'payment.session.fail', entityType: 'Order', entityId: order.number, data: { provider: 'kashier', detail: e instanceof Error ? e.message.slice(0, 200) : 'error' } });
    return null;
  }
}

// ---- OPay ------------------------------------------------------------------
async function buildOpayRedirect(order: CardOrder): Promise<string | null> {
  const cfg = await getOpayConfig();
  if (!cfg) return null;
  const base = opayBaseUrl(cfg.environment);
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
  const base = opayBaseUrl(cfg.environment);
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
 *  Only transitions out of PENDING/FAILED so we never clobber refunds.
 *
 *  Checkout backlog P0: settlement is also what PLACES an online order — a paid
 *  AWAITING_PAYMENT order is promoted to PENDING (the sweep stops chasing it)
 *  and only then do the order-placed notifications fire, so nobody is told
 *  "order placed" for money that never moved. A payment that lands AFTER the
 *  sweep already cancelled (customer paid in the last seconds of an expiring
 *  session) is not silently swallowed: the order is flagged payCheck=PROBLEM
 *  for staff to refund or reinstate by hand. */
export async function markOrderPaid(number: string, provider: string, paid: boolean): Promise<void> {
  const order = await prisma.order.findUnique({ where: { number }, select: { id: true, paymentState: true, status: true } });
  if (!order) return;
  if (order.paymentState === 'PAID' && paid) return; // already settled — idempotent
  if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentState)) return;
  const state = paid ? 'PAID' : 'FAILED';
  if (order.paymentState === state) return;
  await prisma.order.update({ where: { id: order.id }, data: { paymentState: state } });
  await audit({ actorType: 'SYSTEM', action: 'payment.settle', entityType: 'Order', entityId: order.id, data: { provider, number, state } });
  if (!paid) return;
  if (order.status === 'AWAITING_PAYMENT') {
    try {
      // Dynamic imports keep this module's load graph lean for the webhook path
      // (and mirror the codebase's cycle-avoidance pattern).
      const { transitionOrder } = await import('@/lib/order-service');
      await transitionOrder(order.id, 'PENDING', 'payment received', { system: true, silent: true });
    } catch (e) {
      // CAS lost against the sweep's cancel — fall through to the flag below.
      console.error('paid-order promotion failed', number, e instanceof Error ? e.message : e);
      const now = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
      if (now?.status !== 'PENDING') {
        await prisma.order.update({ where: { id: order.id }, data: { payCheck: 'PROBLEM' } });
        await audit({ actorType: 'SYSTEM', action: 'payment.after_cancel', entityType: 'Order', entityId: order.id, data: { provider, number } });
        return;
      }
    }
    const { sendOrderPlacedNotifications } = await import('@/lib/order-placed-notify');
    await sendOrderPlacedNotifications(order.id);
  } else if (order.status === 'CANCELLED') {
    // Paid after the sweep cancelled — money moved for a dead order.
    await prisma.order.update({ where: { id: order.id }, data: { payCheck: 'PROBLEM' } });
    await audit({ actorType: 'SYSTEM', action: 'payment.after_cancel', entityType: 'Order', entityId: order.id, data: { provider, number } });
  }
}

export { getKashierConfig, getOpayConfig };
