import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { generateReferralCode } from '@/lib/customer';
import type { SpamReason } from '@/lib/customer-spam';

/** Staff-side customer management (backend orders revamp, Phase A): search /
 *  quick-create for the order form + profile editing with address CRUD.
 *  Reads gate on customers.read, writes on customers.write. */

export type CustomerHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addresses: { id: string; governorate: string; city: string; area: string; street: string | null; building: string | null; phone: string | null; isDefaultShipping: boolean }[];
};

const fullName = (c: { firstName: string | null; lastName: string | null; user: { name: string | null } }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') || c.user.name || '';

/** Search customers by name / email / phone (incl. address phones). Top 10. */
export async function searchCustomers(q: string): Promise<CustomerHit[]> {
  await requirePermission('customers.read');
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await prisma.customer.findMany({
    where: {
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { phone: { contains: term } } },
        { addresses: { some: { phone: { contains: term } } } },
      ],
    },
    include: { user: { select: { name: true, email: true, phone: true } }, addresses: { orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }] } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });
  return rows.map((c) => ({
    id: c.id,
    name: fullName(c),
    email: c.user.email,
    phone: c.user.phone,
    addresses: c.addresses.map((a) => ({ id: a.id, governorate: a.governorate, city: a.city, area: a.area, street: a.street, building: a.building, phone: a.phone, isDefaultShipping: a.isDefaultShipping })),
  }));
}

/** Quick-create a customer from the order form (phone required; email optional). */
export async function quickCreateCustomer(input: { name: string; phone: string; email?: string | null }): Promise<CustomerHit> {
  const staff = await requirePermission('customers.write');
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email?.trim().toLowerCase() || null;
  if (!name || phone.length < 6) throw new Error('INVALID');
  if (email && (await prisma.user.findUnique({ where: { email } }))) throw new Error('EMAIL_TAKEN');

  const [firstName, ...rest] = name.split(/\s+/);
  const greenTier = await prisma.tier.findUnique({ where: { key: 'GREEN' } }).catch(() => null);
  const customer = await prisma.customer.create({
    data: {
      user: { create: { name, email, phone } },
      firstName,
      lastName: rest.join(' ') || null,
      ...(greenTier ? { tier: { connect: { id: greenTier.id } } } : {}),
      referralCode: await generateReferralCode(),
      wishlistLists: { create: { name: 'My Wishlist', isDefault: true } },
    },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });
  await audit({ actorType: 'USER', actorId: staff.id, action: 'customer.quick_create', entityType: 'Customer', entityId: customer.id });
  return { id: customer.id, name, email: customer.user.email, phone: customer.user.phone, addresses: [] };
}

/** Full profile for the admin customer page. */
export function getCustomerAdmin(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true, username: true, emailVerified: true, phoneVerified: true } },
      tier: true,
      addresses: { orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }] },
      orders: { orderBy: { placedAt: 'desc' }, take: 10, select: { id: true, number: true, status: true, totalPiastres: true, placedAt: true } },
    },
  });
}

const detailsSchema = z.object({
  firstName: z.string().trim().max(60).optional().nullable(),
  lastName: z.string().trim().max(60).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  tierId: z.string().optional().nullable(),
  // Manual/paid tier lock: while set (and not past `until`), auto-recompute and
  // the net-sync customer pull leave tierId alone. A paid SELECT membership =
  // lock + until ≈ one year out.
  tierManual: z.boolean().default(false),
  tierManualUntil: z.coerce.date().optional().nullable(),
});

// Standing + marketing + internal notes (V5 F31/F35).
const standingSchema = z.object({
  status: z.enum(['ACTIVE', 'FLAGGED', 'BLOCKED']),
  marketingConsent: z.boolean().default(false),
  marketingSmsConsent: z.boolean().default(false),
  adminNotes: z.string().trim().max(4000).optional().default(''),
});

export async function updateCustomerStanding(id: string, raw: z.input<typeof standingSchema>) {
  const user = await requirePermission('customers.write');
  const d = standingSchema.parse(raw);
  await prisma.customer.update({
    where: { id },
    data: { status: d.status, marketingConsent: d.marketingConsent, marketingSmsConsent: d.marketingSmsConsent, adminNotes: d.adminNotes || null },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'customer.standing', entityType: 'Customer', entityId: id });
}

/** One suspected fake account as shown on the review screen. */
export type SpamSuspect = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  ordersCount: number;
  status: string;
  reasons: SpamReason[];
  purgeable: boolean; // strong signal + never bought + never verified
};

/** Run the heuristics over every non-blocked customer. Read-only — the review
 *  screen and the delete action both start here so what staff approve is
 *  exactly what gets deleted. */
async function collectSuspects(): Promise<{ scanned: number; suspects: SpamSuspect[] }> {
  const { findSuspicious, isPurgeable } = await import('@/lib/customer-spam');
  const rows = await prisma.customer.findMany({
    where: { status: { in: ['ACTIVE', 'FLAGGED'] } },
    select: {
      id: true, firstName: true, lastName: true, createdAt: true, status: true,
      user: { select: { email: true, name: true, phone: true, emailVerified: true, phoneVerified: true } },
      _count: { select: { orders: true } },
    },
  });
  const candidates = rows.map((r) => ({
    id: r.id,
    email: r.user.email,
    name: r.user.name,
    firstName: r.firstName,
    lastName: r.lastName,
    createdAt: r.createdAt,
    ordersCount: r._count.orders,
    emailVerified: r.user.emailVerified,
    phoneVerified: r.user.phoneVerified,
  }));
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const found = findSuspicious(candidates);

  const suspects: SpamSuspect[] = [];
  for (const r of rows) {
    const reasons = found.get(r.id);
    if (!reasons) continue;
    suspects.push({
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.user.name || '',
      email: r.user.email,
      phone: r.user.phone,
      createdAt: r.createdAt,
      ordersCount: r._count.orders,
      status: r.status,
      reasons,
      purgeable: isPurgeable(byId.get(r.id)!, reasons),
    });
  }
  // Deletable first, then noisiest, then newest — the order staff review in.
  suspects.sort((a, b) =>
    Number(b.purgeable) - Number(a.purgeable)
    || b.reasons.length - a.reasons.length
    || b.createdAt.getTime() - a.createdAt.getTime());
  return { scanned: rows.length, suspects };
}

/** Review screen data (owner 2026-07-22): who the detector thinks is fake, and
 *  which of those are safe to delete outright. Read-only. */
export async function listSpamSuspects(): Promise<{ scanned: number; suspects: SpamSuspect[] }> {
  await requirePermission('customers.read');
  return collectSuspects();
}

/** Heuristic spam scan (V5 F31): flags suspicious ACTIVE accounts as FLAGGED
 *  (reversible; review via the Flagged filter, then bulk block/delete). The
 *  reasons are appended to each customer's internal notes for review. */
export async function scanAndFlagSuspicious(): Promise<{ scanned: number; flagged: number; purgeable: number }> {
  const user = await requirePermission('customers.write');
  const { scanned, suspects } = await collectSuspects();
  const toFlag = suspects.filter((s) => s.status === 'ACTIVE');

  const notes = await prisma.customer.findMany({
    where: { id: { in: toFlag.map((s) => s.id) } },
    select: { id: true, adminNotes: true },
  });
  const notesById = new Map(notes.map((r) => [r.id, r.adminNotes]));
  const stamp = new Date().toISOString().slice(0, 10);
  for (const s of toFlag) {
    const line = `[spam-scan ${stamp}] ${s.reasons.join(', ')}`;
    const existing = notesById.get(s.id);
    await prisma.customer.update({
      where: { id: s.id },
      data: { status: 'FLAGGED', adminNotes: existing ? `${existing}\n${line}` : line },
    });
  }
  await audit({ actorType: 'USER', actorId: user.id, action: 'customer.spamScan', entityType: 'Customer', entityId: `${toFlag.length} flagged of ${scanned}` });
  return { scanned, flagged: toFlag.length, purgeable: suspects.filter((s) => s.purgeable).length };
}

/**
 * Delete suspected fake accounts (owner 2026-07-22). `ids` comes from the
 * review screen, but the heuristics are re-run here and each id must STILL be
 * purgeable — a stale tab, a hand-edited form or an account that ordered in the
 * meantime can never delete a real customer. Anything not re-confirmed is
 * skipped and reported. Deleting the User cascades the Customer and its
 * addresses/wishlists; an unexpected FK just skips the row.
 */
export async function deleteSpamCustomers(ids: string[]): Promise<{ deleted: number; skipped: number }> {
  const user = await requirePermission('customers.write');
  if (ids.length === 0) return { deleted: 0, skipped: 0 };

  const { suspects } = await collectSuspects();
  const confirmed = new Set(suspects.filter((s) => s.purgeable).map((s) => s.id));
  let deleted = 0;
  let skipped = 0;

  for (const id of ids) {
    if (!confirmed.has(id)) { skipped++; continue; }
    const c = await prisma.customer.findUnique({ where: { id }, select: { userId: true, _count: { select: { orders: true } } } });
    if (!c || c._count.orders > 0) { skipped++; continue; }
    try {
      await prisma.user.delete({ where: { id: c.userId } });
      deleted++;
    } catch {
      skipped++;
    }
  }
  await audit({ actorType: 'USER', actorId: user.id, action: 'customer.spamDelete', entityType: 'Customer', entityId: `${deleted} deleted, ${skipped} skipped of ${ids.length} selected` });
  return { deleted, skipped };
}

export async function updateCustomerDetails(id: string, raw: z.input<typeof detailsSchema>) {
  const user = await requirePermission('customers.write');
  const d = detailsSchema.parse(raw);
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id }, select: { userId: true } });

  const email = d.email ? d.email.toLowerCase() : null;
  if (email) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== customer.userId) throw new Error('EMAIL_TAKEN');
  }
  const name = [d.firstName, d.lastName].filter(Boolean).join(' ') || null;

  await prisma.$transaction([
    prisma.customer.update({
      where: { id },
      data: {
        firstName: d.firstName || null,
        lastName: d.lastName || null,
        tierId: d.tierId || null,
        tierManual: d.tierManual,
        tierManualUntil: d.tierManual ? (d.tierManualUntil ?? null) : null,
      },
    }),
    prisma.user.update({ where: { id: customer.userId }, data: { email, phone: d.phone || null, ...(name ? { name } : {}) } }),
  ]);
  await audit({ actorType: 'USER', actorId: user.id, action: 'customer.update', entityType: 'Customer', entityId: id, data: d.tierManual ? { tierManual: true, tierManualUntil: d.tierManualUntil?.toISOString() ?? null } : undefined });
  // Contract v2: name/phone are Veeey-mastered — push the change (no-op unless armed).
  await (await import('@/lib/integration/product-customer-sync')).emitCustomerUpsertV2(id);
}

const addressSchema = z.object({
  governorate: z.string().trim().min(1),
  city: z.string().trim().min(1),
  area: z.string().trim().optional().default(''),
  street: z.string().trim().optional().nullable(),
  building: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  isDefaultShipping: z.boolean().default(false),
});

export async function saveCustomerAddress(customerId: string, addressId: string | null, raw: z.input<typeof addressSchema>) {
  const user = await requirePermission('customers.write');
  const d = addressSchema.parse(raw);
  const data = { governorate: d.governorate, city: d.city, area: d.area, street: d.street || null, building: d.building || null, phone: d.phone || null, isDefaultShipping: d.isDefaultShipping };

  await prisma.$transaction(async (tx) => {
    if (d.isDefaultShipping) await tx.address.updateMany({ where: { customerId }, data: { isDefaultShipping: false } });
    if (addressId) {
      // Ownership guard — the address must belong to this customer.
      await tx.address.findFirstOrThrow({ where: { id: addressId, customerId }, select: { id: true } });
      await tx.address.update({ where: { id: addressId }, data });
    } else {
      await tx.address.create({ data: { ...data, customerId } });
    }
  });
  await audit({ actorType: 'USER', actorId: user.id, action: addressId ? 'customer.address.update' : 'customer.address.create', entityType: 'Customer', entityId: customerId });
}

/** Delete an address. Fails soft (IN_USE) when past orders reference it. */
export async function deleteCustomerAddress(customerId: string, addressId: string) {
  const user = await requirePermission('customers.write');
  await prisma.address.findFirstOrThrow({ where: { id: addressId, customerId }, select: { id: true } });
  const used = await prisma.order.count({ where: { shippingAddressId: addressId } });
  if (used > 0) throw new Error('IN_USE');
  await prisma.address.delete({ where: { id: addressId } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'customer.address.delete', entityType: 'Customer', entityId: customerId });
}
