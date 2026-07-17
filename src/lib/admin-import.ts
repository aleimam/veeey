import 'server-only';
import { prisma } from '@/lib/prisma';
import { egpToPiastres } from '@/lib/format';
import { decodeEntities } from '@/lib/decode-entities';
import { generateReferralCode } from '@/lib/customer';
import { createProduct } from '@/lib/catalog-service';
import { resolveImportPayment } from '@/lib/payment-method-service';
import { resolveImportStatus, customerStatusOf } from '@/lib/order-status-service';
import type { PermissionKey } from '@/lib/permissions';
import type { ExportEntity } from '@/lib/admin-export';

/**
 * Admin CSV import (FR-ADM). Create-only: a row whose key already exists is
 * SKIPPED; invalid rows are skipped + reported (the rest still import). Imports
 * insert plain records — no live side effects (stock, payment, notifications) —
 * i.e. a data load. Each importer is RBAC-gated via IMPORT_PERMISSION at the
 * action layer.
 */
/** Entities that support CSV IMPORT — a subset of the exportable ones ('lots'
 *  is export-only; stock loads go through the go-live bulk stock CSV). */
export type ImportEntity = Exclude<ExportEntity, 'lots'>;
export const IMPORT_PERMISSION: Record<ImportEntity, PermissionKey> = {
  products: 'catalog.write',
  brands: 'catalog.write',
  categories: 'catalog.write',
  customers: 'customers.write',
  orders: 'orders.write',
  returns: 'returns.manage',
  reviews: 'reviews.moderate',
};

export type ImportReport = { created: number; skipped: number; invalid: { row: number; reason: string }[] };
type Row = Record<string, string>;
type Outcome = 'created' | 'skipped' | { error: string };

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const num = (s: string | undefined) => { const n = Number(s); return Number.isFinite(n) ? n : null; };
const truthy = (s: string | undefined) => /^(yes|true|1)$/i.test((s ?? '').trim());
const oneOf = <T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes((v ?? '').trim()) ? ((v as string).trim() as T) : fallback;

async function run(rows: Row[], handler: (r: Row) => Promise<Outcome>): Promise<ImportReport> {
  const rep: ImportReport = { created: 0, skipped: 0, invalid: [] };
  for (let i = 0; i < rows.length; i++) {
    try {
      const res = await handler(rows[i]);
      if (res === 'created') rep.created++;
      else if (res === 'skipped') rep.skipped++;
      else rep.invalid.push({ row: i + 2, reason: res.error }); // +2 = header row + 1-based
    } catch (e) {
      rep.invalid.push({ row: i + 2, reason: e instanceof Error ? e.message.slice(0, 160) : 'error' });
    }
  }
  return rep;
}

async function idsByNames(model: 'category' | 'tag', csv?: string): Promise<string[]> {
  const names = (csv ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  if (!names.length) return [];
  const found = model === 'category'
    ? await prisma.category.findMany({ where: { nameEn: { in: names } }, select: { id: true } })
    : await prisma.tag.findMany({ where: { nameEn: { in: names } }, select: { id: true } });
  return found.map((f) => f.id);
}

// ---- importers -------------------------------------------------------------
const importBrands = (rows: Row[]) => run(rows, async (r) => {
  // CSV round-trip (V7 C1): a re-imported old export may carry entity-escaped
  // names — decode at ingest, same as the WooCommerce sync.
  const nameEn = decodeEntities(r.nameEn ?? '').trim();
  if (!nameEn) return { error: 'nameEn required' };
  const slug = r.slug?.trim() || slugify(nameEn);
  if (!slug) return { error: 'cannot derive slug' };
  if (await prisma.brand.findUnique({ where: { slug } })) return 'skipped';
  await prisma.brand.create({ data: { slug, nameEn, nameAr: r.nameAr || null, descriptionEn: r.descriptionEn || null } });
  return 'created';
});

const importCategories = (rows: Row[]) => run(rows, async (r) => {
  const nameEn = decodeEntities(r.nameEn ?? '').trim();
  if (!nameEn) return { error: 'nameEn required' };
  const slug = r.slug?.trim() || slugify(nameEn);
  if (await prisma.category.findUnique({ where: { slug } })) return 'skipped';
  let parentId: string | null = null;
  if (r.parent?.trim()) {
    const p = await prisma.category.findUnique({ where: { slug: r.parent.trim() } });
    if (!p) return { error: `parent slug not found: ${r.parent}` };
    parentId = p.id;
  }
  await prisma.category.create({ data: { slug, nameEn, nameAr: r.nameAr || null, parentId } });
  return 'created';
});

const importProducts = (rows: Row[]) => run(rows, async (r) => {
  const sku = r.sku?.trim();
  const nameEn = decodeEntities(r.nameEn ?? '').trim();
  if (!sku) return { error: 'sku required' };
  if (!nameEn) return { error: 'nameEn required' };
  if (await prisma.product.findUnique({ where: { sku } })) return 'skipped';
  let brandId: string | undefined;
  if (r.brand?.trim()) {
    const b = await prisma.brand.findFirst({ where: { nameEn: r.brand.trim() } });
    if (!b) return { error: `brand not found: ${r.brand}` };
    brandId = b.id;
  }
  await createProduct({
    sku,
    nameEn,
    nameAr: r.nameAr || undefined,
    kind: oneOf(r.kind, ['SUPPLEMENT', 'DEVICE', 'INJECTION'] as const, 'SUPPLEMENT'),
    status: oneOf(r.status, ['DRAFT', 'PUBLISHED', 'PRIVATE', 'ARCHIVED'] as const, 'PUBLISHED'),
    brandId,
    basePriceEgp: num(r.basePriceEgp) ?? 0,
    categoryIds: (await idsByNames('category', r.categories)).slice(0, 4),
    tagIds: await idsByNames('tag', r.tags),
  });
  return 'created';
});

const importCustomers = (rows: Row[]) => run(rows, async (r) => {
  const email = r.email?.trim().toLowerCase();
  if (!email) return { error: 'email required' };
  if (await prisma.user.findUnique({ where: { email } })) return 'skipped';
  let tierId: string | null = null;
  if (r.tier?.trim()) tierId = (await prisma.tier.findFirst({ where: { nameEn: r.tier.trim() } }))?.id ?? null;
  if (!tierId) tierId = (await prisma.tier.findUnique({ where: { key: 'GREEN' } }))?.id ?? null;
  const name = [r.firstName, r.lastName].map((s) => s?.trim()).filter(Boolean).join(' ') || null;
  const user = await prisma.user.create({ data: { email, name, phone: r.phone || null } });
  await prisma.customer.create({
    data: {
      userId: user.id,
      firstName: r.firstName || null,
      lastName: r.lastName || null,
      tierId,
      marketingConsent: truthy(r.marketingConsent),
      referralCode: await generateReferralCode(),
      wishlistLists: { create: { name: 'My Wishlist', isDefault: true } },
    },
  });
  return 'created';
});

const importOrders = (rows: Row[]) => run(rows, async (r) => {
  const number = r.number?.trim();
  if (!number) return { error: 'number required' };
  if (await prisma.order.findUnique({ where: { number } })) return 'skipped';
  let customerId: string | null = null;
  if (r.customerEmail?.trim()) {
    const u = await prisma.user.findUnique({ where: { email: r.customerEmail.trim().toLowerCase() }, include: { customer: true } });
    customerId = u?.customer?.id ?? null;
  }
  const total = egpToPiastres(num(r.totalEgp) ?? 0);
  const rawPay = (r.paymentMethod ?? '').trim();
  const pay = await resolveImportPayment(rawPay); // map raw value → {customer, system} via aliases
  const rawStatus = (r.status ?? '').trim();
  const statusCode = (await resolveImportStatus(rawStatus)) ?? 'PENDING';
  await prisma.order.create({
    data: {
      number,
      customerId,
      guestEmail: customerId ? null : (r.customerEmail || null),
      status: statusCode,
      customerStatus: await customerStatusOf(statusCode),
      legacyStatus: rawStatus || null,
      paymentMethod: pay.customerCode,
      systemPaymentMethod: pay.systemCode,
      legacyPaymentMethod: rawPay || null,
      subtotalPiastres: total,
      totalPiastres: total,
      shippingAddressJson: { governorate: r.governorate || '', city: r.city || '', street: r.street || '' },
      ...(r.placedAt && !Number.isNaN(Date.parse(r.placedAt)) ? { placedAt: new Date(r.placedAt) } : {}),
    },
  });
  return 'created';
});

const importReturns = (rows: Row[]) => run(rows, async (r) => {
  const orderNumber = (r.orderNumber || r.number)?.trim();
  if (!orderNumber) return { error: 'orderNumber required' };
  const order = await prisma.order.findUnique({ where: { number: orderNumber } });
  if (!order) return { error: `order not found: ${orderNumber}` };
  const status = oneOf(r.status, ['REQUESTED', 'APPROVED', 'QUARANTINE', 'RESTOCKED', 'WRITTEN_OFF', 'REFUNDED', 'REJECTED'] as const, 'REQUESTED');
  const reasonCode = r.reasonCode?.trim() || 'OTHER';
  if (await prisma.return.findFirst({ where: { orderId: order.id, reasonCode, status } })) return 'skipped';
  await prisma.return.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      reasonCode,
      status,
      refundMethod: r.refundMethod || null,
      refundPiastres: r.refundEgp ? egpToPiastres(num(r.refundEgp) ?? 0) : null,
    },
  });
  return 'created';
});

const importReviews = (rows: Row[]) => run(rows, async (r) => {
  const sku = r.productSku?.trim();
  if (!sku) return { error: 'productSku required' };
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) return { error: `product not found: ${sku}` };
  const rating = num(r.rating);
  if (!rating || rating < 1 || rating > 5) return { error: 'rating must be 1–5' };
  let customerId: string | null = null;
  if (r.email?.trim()) {
    const u = await prisma.user.findUnique({ where: { email: r.email.trim().toLowerCase() }, include: { customer: true } });
    customerId = u?.customer?.id ?? null;
  }
  const body = r.body || null;
  const authorName = r.authorName || null;
  if (await prisma.review.findFirst({ where: { productId: product.id, body, authorName } })) return 'skipped';
  await prisma.review.create({
    data: {
      productId: product.id,
      customerId,
      authorName,
      rating: Math.round(rating),
      title: r.title || null,
      body,
      status: oneOf(r.status, ['PENDING', 'APPROVED', 'REJECTED'] as const, 'PENDING'),
    },
  });
  return 'created';
});

const IMPORTERS: Record<ImportEntity, (rows: Row[]) => Promise<ImportReport>> = {
  products: importProducts,
  brands: importBrands,
  categories: importCategories,
  customers: importCustomers,
  orders: importOrders,
  returns: importReturns,
  reviews: importReviews,
};

export const isImportEntity = (entity: string): entity is ImportEntity => entity in IMPORTERS;

export async function importEntity(entity: ImportEntity, rows: Row[]): Promise<ImportReport> {
  return IMPORTERS[entity](rows);
}
