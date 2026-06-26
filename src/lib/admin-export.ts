import { prisma } from '@/lib/prisma';
import { buildCsv } from '@/lib/csv-io';
import type { PermissionKey } from '@/lib/permissions';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Admin CSV export (FR-ADM). One adapter per entity: builds a filtered query from
 * URL params (the same filters the list pages use) and maps rows to CSV. Gated by
 * each entity's read permission (see EXPORT_PERMISSION).
 */
export type ExportEntity = 'products' | 'brands' | 'categories' | 'customers' | 'orders' | 'returns' | 'reviews';
export const EXPORT_ENTITIES: ExportEntity[] = ['products', 'brands', 'categories', 'customers', 'orders', 'returns', 'reviews'];

export const EXPORT_PERMISSION: Record<ExportEntity, PermissionKey> = {
  products: 'catalog.read',
  brands: 'catalog.read',
  categories: 'catalog.read',
  customers: 'customers.read',
  orders: 'orders.read',
  returns: 'returns.manage',
  reviews: 'reviews.moderate',
};

type SP = Record<string, string | undefined>;
const egp = (b: bigint | null | undefined) => (b == null ? '' : String(Number(b) / 100));
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });

type Built = { headers: string[]; rows: unknown[][] };

async function products(sp: SP): Promise<Built> {
  const where: Prisma.ProductWhereInput = {
    ...(sp.ids ? { id: { in: sp.ids.split('~') } } : {}),
    ...(sp.q ? { OR: [{ nameEn: ci(sp.q) }, { sku: ci(sp.q) }] } : {}),
    ...(sp.kind ? { kind: sp.kind as 'SUPPLEMENT' | 'DEVICE' | 'INJECTION' } : {}),
    ...(sp.status ? { status: sp.status as 'DRAFT' | 'PUBLISHED' | 'PRIVATE' | 'ARCHIVED' } : {}),
    ...(sp.brand ? { brandId: sp.brand } : {}),
  };
  const rows = await prisma.product.findMany({ where, include: { brand: true }, orderBy: { nameEn: 'asc' } });
  return {
    headers: ['sku', 'nameEn', 'nameAr', 'kind', 'status', 'brand', 'basePriceEgp', 'ratingAvg', 'ratingCount', 'createdAt'],
    rows: rows.map((p) => [p.sku, p.nameEn, p.nameAr ?? '', p.kind, p.status, p.brand?.nameEn ?? '', egp(p.basePricePiastres), p.ratingAvg ?? 0, p.ratingCount, iso(p.createdAt)]),
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

async function customers(sp: SP): Promise<Built> {
  const where: Prisma.CustomerWhereInput = {
    ...(sp.ids ? { id: { in: sp.ids.split('~') } } : {}),
    ...(sp.tier ? { tierId: sp.tier } : {}),
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

const BUILDERS: Record<ExportEntity, (sp: SP) => Promise<Built>> = { products, brands, categories, customers, orders, returns, reviews };

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
