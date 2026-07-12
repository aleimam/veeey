import { prisma } from '@/lib/prisma';
import { buildCsv } from '@/lib/csv-io';
import { productAdminWhere } from '@/lib/catalog-service';
import type { PermissionKey } from '@/lib/permissions';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Admin CSV export (FR-ADM). One adapter per entity: builds a filtered query from
 * URL params (the same filters the list pages use) and maps rows to CSV. Gated by
 * each entity's read permission (see EXPORT_PERMISSION).
 */
export type ExportEntity = 'products' | 'brands' | 'categories' | 'customers' | 'orders' | 'returns' | 'reviews' | 'lots';
export const EXPORT_ENTITIES: ExportEntity[] = ['products', 'brands', 'categories', 'customers', 'orders', 'returns', 'reviews', 'lots'];

export const EXPORT_PERMISSION: Record<ExportEntity, PermissionKey> = {
  products: 'catalog.read',
  brands: 'catalog.read',
  categories: 'catalog.read',
  // Customer PII leaves the building on export — gated above plain read (V5 F36).
  customers: 'customers.write',
  orders: 'orders.read',
  returns: 'returns.manage',
  reviews: 'reviews.moderate',
  lots: 'inventory.manage',
};

type SP = Record<string, string | undefined>;
const egp = (b: bigint | null | undefined) => (b == null ? '' : String(Number(b) / 100));
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });

type Built = { headers: string[]; rows: unknown[][] };

async function products(sp: SP): Promise<Built> {
  // Same where-builder as the list page, so the export honors every filter
  // (incl. completeness / sourcing / stock flags); ids = export-selected.
  const where: Prisma.ProductWhereInput = {
    ...(await productAdminWhere({ search: sp.q, kind: sp.kind, status: sp.status, brand: sp.brand, flag: sp.flag, origin: sp.origin })),
    ...(sp.ids ? { id: { in: sp.ids.split('~') } } : {}),
  };
  const rows = await prisma.product.findMany({ where, include: { brand: true }, orderBy: { nameEn: 'asc' } });
  return {
    headers: ['sku', 'nameEn', 'nameAr', 'kind', 'status', 'brand', 'basePriceEgp', 'originCountry', 'purchaseCost', 'purchaseCurrency', 'ratingAvg', 'ratingCount', 'createdAt'],
    rows: rows.map((p) => [p.sku, p.nameEn, p.nameAr ?? '', p.kind, p.status, p.brand?.nameEn ?? '', egp(p.basePricePiastres), p.originCountry ?? '', p.purchaseCostMinor != null ? String(p.purchaseCostMinor / 100) : '', p.purchaseCurrency ?? '', p.ratingAvg ?? 0, p.ratingCount, iso(p.createdAt)]),
  };
}

async function brands(sp: SP): Promise<Built> {
  const where: Prisma.BrandWhereInput = {
    ...(sp.q ? { nameEn: ci(sp.q) } : {}),
    ...(sp.archived === '1' ? { archivedAt: { not: null } } : { archivedAt: null }),
  };
  const rows = await prisma.brand.findMany({ where, include: { _count: { select: { products: true } } }, orderBy: { nameEn: 'asc' } });
  return {
    headers: ['slug', 'nameEn', 'nameAr', 'descriptionEn', 'products', 'archived'],
    rows: rows.map((b) => [b.slug, b.nameEn, b.nameAr ?? '', b.descriptionEn ?? '', b._count.products, b.archivedAt ? 'yes' : '']),
  };
}

async function categories(sp: SP): Promise<Built> {
  const where: Prisma.CategoryWhereInput = {
    ...(sp.q ? { nameEn: ci(sp.q) } : {}),
    ...(sp.archived === '1' ? { archivedAt: { not: null } } : { archivedAt: null }),
  };
  const rows = await prisma.category.findMany({ where, include: { parent: true, _count: { select: { products: true } } }, orderBy: { nameEn: 'asc' } });
  return {
    headers: ['slug', 'nameEn', 'nameAr', 'parent', 'products', 'archived'],
    rows: rows.map((c) => [c.slug, c.nameEn, c.nameAr ?? '', c.parent?.slug ?? '', c._count.products, c.archivedAt ? 'yes' : '']),
  };
}

/** Customer segment → where clause (mirrors the customers list filters). */
async function customerSegWhere(seg?: string): Promise<Prisma.CustomerWhereInput> {
  if (seg === 'no-orders') return { orders: { none: {} } };
  if (seg === 'with-orders') return { orders: { some: {} } };
  if (seg === 'repeat') {
    const rows = await prisma.$queryRaw<{ customerId: string }[]>`SELECT "customerId" FROM "Order" WHERE "customerId" IS NOT NULL GROUP BY "customerId" HAVING COUNT(*) >= 2`;
    return { id: { in: rows.map((r) => r.customerId) } };
  }
  if (seg === 'high-value') {
    const { getNumberSetting } = await import('@/lib/settings-service');
    return { lifetimeSpendPiastres: { gte: BigInt(Math.round((await getNumberSetting('customers.highValueEgp')) * 100)) } };
  }
  if (seg === 'lapsed') {
    const { getNumberSetting } = await import('@/lib/settings-service');
    const cutoff = new Date(Date.now() - (await getNumberSetting('customers.lapsedDays')) * 86_400_000);
    return { AND: [{ orders: { some: {} } }, { orders: { none: { placedAt: { gte: cutoff } } } }] };
  }
  return {};
}

async function customers(sp: SP): Promise<Built> {
  const where: Prisma.CustomerWhereInput = {
    ...(sp.ids ? { id: { in: sp.ids.split('~') } } : {}),
    ...(sp.tier ? { tierId: sp.tier } : {}),
    ...(sp.status === 'UNVERIFIED'
      ? { status: 'ACTIVE', user: { emailVerified: null, phoneVerified: null } }
      : sp.status === 'ACTIVE' || sp.status === 'FLAGGED' || sp.status === 'BLOCKED'
        ? { status: sp.status }
        : {}),
    ...(await customerSegWhere(sp.seg)),
    ...(sp.q ? { OR: [{ firstName: ci(sp.q) }, { lastName: ci(sp.q) }, { user: { email: ci(sp.q) } }, { user: { phone: ci(sp.q) } }] } : {}),
  };
  const rows = await prisma.customer.findMany({ where, include: { user: { select: { email: true, phone: true } }, tier: true }, orderBy: { createdAt: 'desc' } });
  return {
    headers: ['email', 'firstName', 'lastName', 'phone', 'tier', 'pointsBalance', 'lifetimeSpendEgp', 'referralCode', 'marketingConsent', 'createdAt'],
    rows: rows.map((c) => [c.user.email ?? '', c.firstName ?? '', c.lastName ?? '', c.user.phone ?? '', c.tier?.nameEn ?? '', c.pointsBalance, egp(c.lifetimeSpendPiastres), c.referralCode, c.marketingConsent ? 'yes' : 'no', iso(c.createdAt)]),
  };
}

async function orders(sp: SP): Promise<Built> {
  const where: Prisma.OrderWhereInput = {
    ...(sp.ids ? { id: { in: sp.ids.split('~') } } : {}),
    ...(sp.status ? { status: sp.status as Prisma.OrderWhereInput['status'] } : {}),
    ...(sp.payment ? { paymentMethod: sp.payment as Prisma.OrderWhereInput['paymentMethod'] } : {}),
    ...(sp.payCheck ? { payCheck: sp.payCheck as Prisma.OrderWhereInput['payCheck'] } : {}),
    ...(sp.q ? { number: ci(sp.q) } : {}),
    ...(sp.from || sp.to ? { placedAt: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(`${sp.to}T23:59:59`) } : {}) } } : {}),
  };
  const rows = await prisma.order.findMany({ where, include: { customer: { include: { user: { select: { email: true } } } } }, orderBy: { placedAt: 'desc' } });
  return {
    headers: ['number', 'customerEmail', 'status', 'paymentMethod', 'paymentState', 'totalEgp', 'governorate', 'city', 'placedAt'],
    rows: rows.map((o) => {
      const a = (o.shippingAddressJson ?? {}) as { governorate?: string; city?: string };
      return [o.number, o.customer?.user.email ?? o.guestEmail ?? '', o.status, o.paymentMethod ?? '', o.paymentState, egp(o.totalPiastres), a.governorate ?? '', a.city ?? '', iso(o.placedAt)];
    }),
  };
}

async function returns(sp: SP): Promise<Built> {
  const where: Prisma.ReturnWhereInput = {
    ...(sp.status ? { status: sp.status as Prisma.ReturnWhereInput['status'] } : {}),
    ...(sp.q ? { order: { number: ci(sp.q) } } : {}),
  };
  const rows = await prisma.return.findMany({ where, include: { order: { select: { number: true } } }, orderBy: { createdAt: 'desc' } });
  return {
    headers: ['id', 'orderNumber', 'reasonCode', 'status', 'refundMethod', 'refundEgp', 'createdAt'],
    rows: rows.map((r) => [r.id, r.order.number, r.reasonCode, r.status, r.refundMethod ?? '', egp(r.refundPiastres), iso(r.createdAt)]),
  };
}

async function reviews(sp: SP): Promise<Built> {
  const where: Prisma.ReviewWhereInput = {
    ...(sp.status ? { status: sp.status as Prisma.ReviewWhereInput['status'] } : {}),
    ...(sp.rating ? { rating: Number(sp.rating) } : {}),
    ...(sp.q ? { OR: [{ body: ci(sp.q) }, { authorName: ci(sp.q) }] } : {}),
  };
  const rows = await prisma.review.findMany({ where, include: { product: { select: { sku: true } }, customer: { include: { user: { select: { email: true } } } } }, orderBy: { createdAt: 'desc' } });
  return {
    headers: ['productSku', 'email', 'authorName', 'rating', 'title', 'body', 'status', 'source', 'createdAt'],
    rows: rows.map((r) => [r.product.sku, r.customer?.user.email ?? '', r.authorName ?? '', r.rating, r.title ?? '', r.body ?? '', r.status, r.source, iso(r.createdAt)]),
  };
}

async function lots(sp: SP): Promise<Built> {
  // Same where-builder as the lots list page (V4 C11) — export honors every
  // filter; ids = export-selected from the bulk bar.
  const { lotWhere } = await import('@/lib/inventory-service');
  const where: Prisma.LotWhereInput = {
    ...lotWhere({ search: sp.q, status: sp.status, locationId: sp.location, stock: sp.stock, sale: sp.sale, expiring: sp.expiring, condition: sp.condition }),
    ...(sp.ids ? { id: { in: sp.ids.split('~') } } : {}),
  };
  const rows = await prisma.lot.findMany({
    where,
    include: { product: { select: { sku: true, nameEn: true, basePricePiastres: true } }, location: { select: { name: true } } },
    orderBy: { expiryDate: 'asc' },
  });
  return {
    headers: ['sku', 'product', 'location', 'expiry', 'condition', 'status', 'qtyOnHand', 'qtyReserved', 'sellable', 'basePriceEgp', 'salePriceEgp', 'saleFlag', 'costEgp'],
    rows: rows.map((l) => [
      l.product.sku, l.product.nameEn, l.location.name, iso(l.expiryDate), l.condition, l.status,
      l.qtyOnHand, l.qtyReserved, Math.max(0, l.qtyOnHand - l.qtyReserved),
      egp(l.product.basePricePiastres), egp(l.priceOverridePiastres), l.saleFlag ? 'yes' : '', egp(l.costPiastres),
    ]),
  };
}

const BUILDERS: Record<ExportEntity, (sp: SP) => Promise<Built>> = { products, brands, categories, customers, orders, returns, reviews, lots };

/** Build the CSV string for an entity given the URL filter params. */
export async function buildExportCsv(entity: ExportEntity, sp: SP): Promise<string> {
  const { headers, rows } = await BUILDERS[entity](sp);
  return buildCsv(headers, rows);
}

/** Empty template (header row only) for an entity's importable columns. */
export async function buildTemplateCsv(entity: ExportEntity): Promise<string> {
  const { headers } = await BUILDERS[entity]({});
  return buildCsv(headers, []);
}
