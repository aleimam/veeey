import { randomBytes, randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth-guards';
import { getSetting, getNumberSetting } from '@/lib/settings-service';
import { getShippingFee } from '@/lib/shipping-service';
import { deriveSystemMethod } from '@/lib/payment-method-service';
import { dispatchSms } from '@/lib/notification-dispatch';
import { allocateOrderLine, type Tx } from '@/lib/order-service';
import { isFeatureEnabled } from '@/lib/feature-service';
import { parseFrequencies, advanceNextRun, noticeDue, refillDiscount, parseRefillAddress, type RefillAddress } from '@/lib/refill';

/**
 * Veeey Refill — COD autoship engine (epic #119, owner decisions 2026-07-13):
 * auto-place as Cash-on-Delivery with an SMS advance notice (refill.noticeDays);
 * frequencies from refill.frequencies presets; out-of-stock cycle = SKIP + SMS.
 * Subscribing places the FIRST delivery immediately (same engine). Pure math in
 * refill.ts (tested). The sweep runs in the worker (daily) and no-ops while the
 * Refill feature toggle is OFF.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://veeey.com';

export async function refillSettings() {
  const [discountPercent, noticeDays, freqRaw] = await Promise.all([
    getNumberSetting('refill.discountPercent'),
    getNumberSetting('refill.noticeDays'),
    getSetting('refill.frequencies'),
  ]);
  return {
    discountPercent: discountPercent > 0 ? discountPercent : 15,
    noticeDays: noticeDays > 0 ? noticeDays : 3,
    frequencies: parseFrequencies(freqRaw),
  };
}

type PlanRow = {
  id: string; customerId: string; productId: string; qty: number; frequencyDays: number;
  status: string; nextRunAt: Date; noticedRunAt: Date | null; skipNext: boolean;
  manageToken: string; addressJson: unknown; lastOrderId: string | null;
};

const planInclude = {
  product: { select: { nameEn: true, nameAr: true, slugEn: true } },
  customer: { select: { locale: true, user: { select: { phone: true } } } }, // phone lives on User
} as const;

type PlanSmsCtx = PlanRow & { customer: { locale: string | null; user: { phone: string | null } | null }; product: { nameEn: string; nameAr: string | null } };

const fmtDate = (d: Date, locale: string) => d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });

// ---- Order placement ---------------------------------------------------------

/** Place one COD refill order for a plan. Throws Error('OOS') (tx rolled back)
 *  when stock can't cover the quantity — the sweep records a skipped cycle.
 *  `finalize` runs INSIDE the same transaction so run-log/plan bookkeeping can
 *  never desync from the order (audit: post-commit failures left phantom orders). */
async function placeRefillOrder(
  plan: PlanRow,
  discountPercent: number,
  finalize?: (tx: Tx, orderId: string) => Promise<void>,
): Promise<{ orderId: string; number: string; totalPiastres: bigint }> {
  const addr = parseRefillAddress(plan.addressJson);
  if (!addr) throw new Error('NO_ADDRESS');
  const shipping = await getShippingFee('FAST_FREE');
  const systemPaymentMethod = await deriveSystemMethod('COD', null);
  const number = `VY-RF-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 999)}`;

  return prisma.$transaction(async (tx) => {
    const ord = await tx.order.create({
      data: {
        number,
        customerId: plan.customerId,
        status: 'PENDING', customerStatus: 'PENDING',
        paymentMethod: 'COD', systemPaymentMethod, paymentState: 'PENDING', payCheck: 'NO',
        subtotalPiastres: 0n, shippingPiastres: shipping, discountPiastres: 0n, totalPiastres: shipping,
        shippingType: 'FAST_FREE',
        shippingAddressId: null,
        shippingAddressJson: addr,
        source: 'refill',
      },
    });
    const res = await allocateOrderLine(tx, ord.id, { productId: plan.productId, qty: plan.qty }, 'refill');
    if (res.shortfall > 0) throw new Error('OOS'); // owner choice: skip the cycle, never pre-order
    const discount = refillDiscount(res.subtotal, discountPercent);
    const total = res.subtotal - discount + shipping;
    await tx.order.update({ where: { id: ord.id }, data: { subtotalPiastres: res.subtotal, discountPiastres: discount, totalPiastres: total } });
    if (finalize) await finalize(tx, ord.id);
    return { orderId: ord.id, number, totalPiastres: total };
  });
}

// ---- SMS ----------------------------------------------------------------------

function smsPhone(plan: PlanSmsCtx): string | null {
  const addr = parseRefillAddress(plan.addressJson);
  return addr?.phone || plan.customer.user?.phone || null;
}

async function sendPlanSms(plan: PlanSmsCtx, kind: 'notice' | 'ordered' | 'skipped_oos' | 'skipped_customer', vars: { date?: Date; total?: bigint } = {}) {
  const phone = smsPhone(plan);
  if (!phone) return;
  const ar = plan.customer.locale === 'ar';
  const name = ar ? plan.product.nameAr ?? plan.product.nameEn : plan.product.nameEn;
  const link = `${SITE}/${ar ? 'ar' : 'en'}/refill/manage/${plan.manageToken}`;
  const date = vars.date ? fmtDate(vars.date, ar ? 'ar' : 'en') : '';
  const egp = vars.total != null ? `${Math.round(Number(vars.total) / 100)} EGP` : '';
  const body =
    kind === 'notice'
      ? ar
        ? `فيي ريفيل: طلبك القادم من «${name}» سيُنشأ في ${date} (دفع عند الاستلام). للتخطي أو الإيقاف: ${link}`
        : `Veeey Refill: your next «${name}» order will be placed on ${date} (cash on delivery). Skip or pause: ${link}`
      : kind === 'ordered'
        ? ar
          ? `فيي ريفيل: أُنشئ طلبك من «${name}» (${egp}، دفع عند الاستلام) وسيصلك قريبًا. إدارة الخطة: ${link}`
          : `Veeey Refill: your «${name}» order (${egp}, cash on delivery) was placed and is on its way. Manage: ${link}`
        : kind === 'skipped_oos'
          ? ar
            ? `فيي ريفيل: «${name}» غير متوفر حاليًا، فتخطّينا هذه الدورة — سنحاول في الموعد القادم. إدارة: ${link}`
            : `Veeey Refill: «${name}» is out of stock, so this cycle was skipped — we'll try again next time. Manage: ${link}`
          : ar
            ? `فيي ريفيل: تخطّينا هذه الدورة كما طلبت. الموعد القادم ${date}. إدارة: ${link}`
            : `Veeey Refill: this cycle was skipped as requested. Next delivery ${date}. Manage: ${link}`;
  await dispatchSms(phone, body).catch(() => {});
}

// ---- Sweep (worker) -------------------------------------------------------------

export type RefillSweep = { notified: number; ordered: number; skipped: number; errors: number; skippedReason?: string };

export async function sweepRefills(now = new Date()): Promise<RefillSweep> {
  if (!(await isFeatureEnabled('refill'))) return { notified: 0, ordered: 0, skipped: 0, errors: 0, skippedReason: 'feature off' };
  const { discountPercent, noticeDays } = await refillSettings();
  let notified = 0, ordered = 0, skipped = 0, errors = 0;

  // Phase A — advance-notice SMS for upcoming (strictly FUTURE) runs. Already-due
  // plans are excluded: after worker downtime they'd otherwise get a future-tense
  // notice for a past date immediately followed by the "ordered" SMS.
  const upcoming = await prisma.refillPlan.findMany({
    where: { status: 'ACTIVE', nextRunAt: { gt: now, lte: new Date(now.getTime() + noticeDays * 86_400_000) } },
    include: planInclude,
  });
  for (const plan of upcoming) {
    if (!noticeDue(plan, now, noticeDays)) continue;
    await sendPlanSms(plan, 'notice', { date: plan.nextRunAt });
    await prisma.refillPlan.update({ where: { id: plan.id }, data: { noticedRunAt: plan.nextRunAt } });
    notified += 1;
  }

  // Phase B — place due orders (or record the skip). Each plan's cycle is
  // CLAIMED first with a compare-and-swap on nextRunAt (mirrors transitionOrder):
  // a concurrent sweep (pg-boss retry/overlap) or a crash-and-rerun can never
  // place the same COD order twice — at-most-once per cycle by construction.
  const due = await prisma.refillPlan.findMany({ where: { status: 'ACTIVE', nextRunAt: { lte: now } }, include: planInclude });
  for (const plan of due) {
    const next = advanceNextRun(plan.nextRunAt, plan.frequencyDays, now);
    const claimed = await prisma.refillPlan.updateMany({
      where: { id: plan.id, status: 'ACTIVE', nextRunAt: plan.nextRunAt },
      data: { nextRunAt: next, skipNext: false },
    });
    if (claimed.count === 0) continue; // another sweep owns this cycle
    try {
      if (plan.skipNext) {
        await prisma.refillRun.create({ data: { planId: plan.id, outcome: 'SKIPPED_CUSTOMER' } });
        await sendPlanSms(plan, 'skipped_customer', { date: next });
        skipped += 1;
        continue;
      }
      const res = await placeRefillOrder(plan, discountPercent, async (tx, orderId) => {
        await tx.refillRun.create({ data: { planId: plan.id, outcome: 'ORDERED', orderId } });
        await tx.refillPlan.update({ where: { id: plan.id }, data: { lastOrderId: orderId } });
      });
      await sendPlanSms(plan, 'ordered', { total: res.totalPiastres });
      ordered += 1;
    } catch (e) {
      if (e instanceof Error && e.message === 'OOS') {
        await prisma.refillRun.create({ data: { planId: plan.id, outcome: 'SKIPPED_OOS' } });
        await sendPlanSms(plan, 'skipped_oos');
        skipped += 1;
      } else {
        // Unexpected — the cycle is consumed (claim already advanced nextRunAt):
        // a missed delivery beats a duplicate COD order. Staff see it in the runs.
        await prisma.refillRun.create({ data: { planId: plan.id, outcome: 'ERROR', note: e instanceof Error ? e.message.slice(0, 200) : 'unknown' } }).catch(() => {});
        errors += 1;
      }
    }
  }
  return { notified, ordered, skipped, errors };
}

// ---- Subscribe (storefront) -----------------------------------------------------

export type CreatePlanResult = { planId: string; orderNumber: string } | { error: 'NO_ADDRESS' | 'OOS' | 'INVALID' };

/** Create a plan for a signed-in customer and place the FIRST delivery now.
 *  Address = the customer's most recent saved address (checkout keeps these). */
export async function createRefillPlan(input: { customerId: string; productId: string; qty: number; frequencyDays: number }): Promise<CreatePlanResult> {
  const { discountPercent, frequencies } = await refillSettings();
  const qty = Math.min(10, Math.max(1, Math.round(input.qty)));
  if (!frequencies.includes(input.frequencyDays)) return { error: 'INVALID' };
  const [product, customer, address] = await Promise.all([
    prisma.product.findFirst({ where: { id: input.productId, status: 'PUBLISHED' }, select: { id: true } }),
    prisma.customer.findUnique({ where: { id: input.customerId }, select: { firstName: true, lastName: true, user: { select: { name: true, phone: true } } } }),
    // Default-shipping address first, else the newest — this snapshot routes
    // EVERY future auto-order, so the pick matters (audit: id-desc was neither).
    prisma.address.findFirst({ where: { customerId: input.customerId }, orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }] }),
  ]);
  if (!product || !customer) return { error: 'INVALID' };
  if (!address) return { error: 'NO_ADDRESS' };
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.user?.name || 'Veeey customer';
  const addr: RefillAddress = { name, phone: address.phone || customer.user?.phone || '', governorate: address.governorate, city: address.city, area: address.area, street: address.street ?? '' };
  if (!parseRefillAddress(addr)) return { error: 'NO_ADDRESS' };

  const plan = await prisma.refillPlan.create({
    data: {
      customerId: input.customerId, productId: input.productId, qty,
      frequencyDays: input.frequencyDays, status: 'ACTIVE',
      nextRunAt: new Date(), manageToken: randomBytes(24).toString('hex'),
      addressJson: addr, addressId: address.id,
    },
    include: planInclude,
  });
  try {
    // Run-log + schedule advance commit INSIDE the order transaction — a failure
    // anywhere rolls back everything, so the catch below can never orphan a
    // committed order (audit fix).
    const next = advanceNextRun(plan.nextRunAt, plan.frequencyDays, new Date());
    const res = await placeRefillOrder(plan, discountPercent, async (tx, orderId) => {
      await tx.refillRun.create({ data: { planId: plan.id, outcome: 'ORDERED', orderId } });
      await tx.refillPlan.update({ where: { id: plan.id }, data: { nextRunAt: next, lastOrderId: orderId } });
    });
    await sendPlanSms(plan, 'ordered', { total: res.totalPiastres });
    await audit({ actorType: 'SYSTEM', action: 'refill.plan.create', entityType: 'RefillPlan', entityId: plan.id, data: { productId: input.productId, qty, frequencyDays: input.frequencyDays } });
    return { planId: plan.id, orderNumber: res.number };
  } catch (e) {
    // First delivery must succeed for a subscription to make sense — undo the
    // plan (the order tx above rolled back in full, so nothing is orphaned).
    await prisma.refillPlan.delete({ where: { id: plan.id } }).catch(() => {});
    return { error: e instanceof Error && e.message === 'OOS' ? 'OOS' : 'INVALID' };
  }
}

// ---- Customer / token management -------------------------------------------------

export type PlanView = {
  id: string; status: string; qty: number; frequencyDays: number; nextRunAt: Date; skipNext: boolean;
  productName: string; productNameAr: string | null; slugEn: string; image: string | null; lastOrderId: string | null;
};

const viewInclude = {
  product: { select: { nameEn: true, nameAr: true, slugEn: true, images: { take: 1, orderBy: { sortOrder: 'asc' as const }, select: { url: true } } } },
} as const;

type PlanWithView = { id: string; status: string; qty: number; frequencyDays: number; nextRunAt: Date; skipNext: boolean; lastOrderId: string | null; product: { nameEn: string; nameAr: string | null; slugEn: string; images: { url: string }[] } };

const toView = (p: PlanWithView): PlanView => ({
  id: p.id, status: p.status, qty: p.qty, frequencyDays: p.frequencyDays, nextRunAt: p.nextRunAt, skipNext: p.skipNext,
  productName: p.product.nameEn, productNameAr: p.product.nameAr, slugEn: p.product.slugEn, image: p.product.images[0]?.url ?? null, lastOrderId: p.lastOrderId,
});

export async function listCustomerPlans(customerId: string): Promise<PlanView[]> {
  const rows = await prisma.refillPlan.findMany({ where: { customerId, status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' }, include: viewInclude });
  return rows.map(toView);
}

export async function getPlanByToken(token: string): Promise<PlanView | null> {
  if (!token || token.length < 20) return null;
  const p = await prisma.refillPlan.findUnique({ where: { manageToken: token }, include: viewInclude });
  return p ? toView(p) : null;
}

export type PlanOp = 'pause' | 'resume' | 'cancel' | 'skip' | 'unskip' | 'frequency';

/** Apply a customer-initiated op. `who` is either the owning customer id or the
 *  manage token (SMS link) — both are full capabilities over the single plan. */
export async function updatePlan(who: { customerId?: string; token?: string }, planId: string | null, op: PlanOp, frequencyDays?: number): Promise<boolean> {
  const plan = who.token
    ? await prisma.refillPlan.findUnique({ where: { manageToken: who.token } })
    : planId && who.customerId
      ? await prisma.refillPlan.findFirst({ where: { id: planId, customerId: who.customerId } })
      : null;
  if (!plan || plan.status === 'CANCELLED') return false;
  const data: Record<string, unknown> = {};
  if (op === 'pause') data.status = 'PAUSED';
  else if (op === 'resume') { data.status = 'ACTIVE'; data.nextRunAt = advanceNextRun(new Date(Date.now() - 1), plan.frequencyDays, new Date()); }
  else if (op === 'cancel') data.status = 'CANCELLED';
  else if (op === 'skip') data.skipNext = true;
  else if (op === 'unskip') data.skipNext = false;
  else if (op === 'frequency') {
    const { frequencies } = await refillSettings();
    if (!frequencyDays || !frequencies.includes(frequencyDays)) return false;
    data.frequencyDays = frequencyDays;
  }
  await prisma.refillPlan.update({ where: { id: plan.id }, data });
  await audit({ actorType: 'SYSTEM', action: `refill.plan.${op}`, entityType: 'RefillPlan', entityId: plan.id });
  return true;
}

// ---- Admin ------------------------------------------------------------------------

export type AdminPlanRow = PlanView & { customerId: string; customerName: string; phone: string | null; createdAt: Date; lastOutcome: string | null };

export async function listRefillPlans(status?: string): Promise<AdminPlanRow[]> {
  const rows = await prisma.refillPlan.findMany({
    where: status ? { status } : undefined,
    orderBy: { nextRunAt: 'asc' },
    take: 300,
    include: {
      ...viewInclude,
      customer: { select: { firstName: true, lastName: true, user: { select: { name: true, email: true, phone: true } } } },
      runs: { orderBy: { at: 'desc' }, take: 1, select: { outcome: true } },
    },
  });
  return rows.map((p) => ({
    ...toView(p),
    customerId: p.customerId,
    customerName: [p.customer.firstName, p.customer.lastName].filter(Boolean).join(' ') || p.customer.user?.name || p.customer.user?.email || '—',
    phone: p.customer.user?.phone ?? null,
    createdAt: p.createdAt,
    lastOutcome: p.runs[0]?.outcome ?? null,
  }));
}

/** Staff pause/cancel (orders.write + audit). */
export async function adminSetPlanStatus(planId: string, status: 'ACTIVE' | 'PAUSED' | 'CANCELLED'): Promise<void> {
  const user = await requirePermission('orders.write');
  const data: Record<string, unknown> = { status };
  if (status === 'ACTIVE') {
    const plan = await prisma.refillPlan.findUniqueOrThrow({ where: { id: planId } });
    data.nextRunAt = advanceNextRun(new Date(Date.now() - 1), plan.frequencyDays, new Date());
  }
  await prisma.refillPlan.update({ where: { id: planId }, data });
  await audit({ actorType: 'USER', actorId: user.id, action: 'refill.plan.admin-status', entityType: 'RefillPlan', entityId: planId, data: { status } });
}
