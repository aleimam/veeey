import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { deleteProduct } from '@/lib/soft-delete-service';

/**
 * One-off data cleanup: remove "Russian/Cyrillic junk" left by the WooCommerce
 * import — spam customers, products, and reviews whose names/content contain
 * Cyrillic characters. Always preview first (findCyrillicJunk), then delete on a
 * confirmed click (deleteCyrillicJunk). Guards protect real data:
 *  - customers are only deleted when they have ZERO orders (others are kept),
 *  - products go through the guarded deleteProduct (skips any on orders/lots),
 *  - reviews delete directly (media cascades).
 * Gated by settings.manage + audited. Bounded by a time budget so a big purge
 * runs in safe chunks (re-run until the preview reads zero).
 */
const CYRILLIC = '[Ѐ-ӿ]'; // Unicode Cyrillic block, as a Postgres POSIX regex class

type CustRow = { id: string; userId: string; firstName: string | null; lastName: string | null; name: string | null; email: string | null; orders: number };
type ProdRow = { id: string; nameEn: string };
type RevRow = { id: string; authorName: string | null; title: string | null; body: string | null };

function matchedCustomers(): Promise<CustRow[]> {
  return prisma.$queryRaw<CustRow[]>`
    SELECT c.id, c."userId", c."firstName", c."lastName", u.name, u.email,
      (SELECT COUNT(*)::int FROM "Order" o WHERE o."customerId" = c.id) AS orders
    FROM "Customer" c JOIN "User" u ON u.id = c."userId"
    WHERE c."firstName" ~ ${CYRILLIC} OR c."lastName" ~ ${CYRILLIC} OR c."nameAr" ~ ${CYRILLIC} OR u.name ~ ${CYRILLIC}`;
}
function matchedProducts(): Promise<ProdRow[]> {
  return prisma.$queryRaw<ProdRow[]>`SELECT id, "nameEn" FROM "Product" WHERE "nameEn" ~ ${CYRILLIC}`;
}
function matchedReviews(): Promise<RevRow[]> {
  return prisma.$queryRaw<RevRow[]>`SELECT id, "authorName", title, body FROM "Review" WHERE "authorName" ~ ${CYRILLIC} OR title ~ ${CYRILLIC} OR body ~ ${CYRILLIC}`;
}

const custLabel = (c: CustRow) => `${[c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '—'}${c.email ? ` <${c.email}>` : ''}`;

export type JunkPreview = {
  customers: { total: number; deletable: number; withOrders: number; samples: string[] };
  products: { total: number; samples: string[] };
  reviews: { total: number; samples: string[] };
};

export async function findCyrillicJunk(): Promise<JunkPreview> {
  const [custs, prods, revs] = await Promise.all([matchedCustomers(), matchedProducts(), matchedReviews()]);
  const withOrders = custs.filter((c) => c.orders > 0);
  return {
    customers: { total: custs.length, deletable: custs.length - withOrders.length, withOrders: withOrders.length, samples: custs.slice(0, 8).map(custLabel) },
    products: { total: prods.length, samples: prods.slice(0, 8).map((p) => p.nameEn) },
    reviews: { total: revs.length, samples: revs.slice(0, 8).map((r) => r.authorName || r.title || (r.body ?? '').slice(0, 40) || '—') },
  };
}

export type JunkDeleteResult = { reviews: number; customers: number; customersKept: number; products: number; productsKept: number; done: boolean };

export async function deleteCyrillicJunk(opts: { budgetMs?: number } = {}): Promise<JunkDeleteResult> {
  const user = await requirePermission('settings.manage');
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const r: JunkDeleteResult = { reviews: 0, customers: 0, customersKept: 0, products: 0, productsKept: 0, done: true };

  // 1) Reviews — single fast delete (ReviewMedia cascades).
  const revIds = (await matchedReviews()).map((x) => x.id);
  for (let i = 0; i < revIds.length; i += 500) {
    r.reviews += (await prisma.review.deleteMany({ where: { id: { in: revIds.slice(i, i + 500) } } })).count;
  }

  // 2) Customers — zero-order only; delete the User (cascades Customer/Address/etc.).
  const custs = await matchedCustomers();
  for (const c of custs) {
    if (c.orders > 0) { r.customersKept++; continue; }
    if (Date.now() > deadline) { r.done = false; break; }
    try { await prisma.user.delete({ where: { id: c.userId } }); r.customers++; }
    catch { r.customersKept++; } // still linked to something (e.g. a non-junk review) — leave it
  }

  // 3) Products — guarded (skips any still on an order/lot).
  if (r.done) {
    const prods = await matchedProducts();
    for (const p of prods) {
      if (Date.now() > deadline) { r.done = false; break; }
      try { await deleteProduct(p.id); r.products++; } catch { r.productsKept++; }
    }
  }

  await audit({ actorType: 'USER', actorId: user.id, action: 'cleanup.cyrillic', entityType: 'Maintenance', entityId: `rev:${r.reviews} cust:${r.customers} prod:${r.products}` });
  return r;
}

/**
 * Pre-translation cleanup: drop taxonomy (brands / categories / tags / attributes)
 * whose English name is actually Arabic script — the owner re-translates later.
 * Unlike the guarded taxonomy deletes, this DETACHES in-use items first (brand →
 * null on products; category/tag join rows auto-removed; attribute cascades its
 * values), then deletes. Preview first, then delete on a confirmed click.
 */
const ARABIC = '[؀-ۿ]'; // Arabic Unicode block, as a Postgres POSIX regex class

type TaxRow = { id: string; nameEn: string };
const arabicBrands = () => prisma.$queryRaw<TaxRow[]>`SELECT id, "nameEn" FROM "Brand" WHERE "nameEn" ~ ${ARABIC}`;
const arabicCategories = () => prisma.$queryRaw<TaxRow[]>`SELECT id, "nameEn" FROM "Category" WHERE "nameEn" ~ ${ARABIC}`;
const arabicTags = () => prisma.$queryRaw<TaxRow[]>`SELECT id, "nameEn" FROM "Tag" WHERE "nameEn" ~ ${ARABIC}`;
const arabicAttributes = () => prisma.$queryRaw<TaxRow[]>`SELECT id, "nameEn" FROM "Attribute" WHERE "nameEn" ~ ${ARABIC}`;

export type ArabicTaxPreview = {
  brands: { total: number; samples: string[] };
  categories: { total: number; samples: string[] };
  tags: { total: number; samples: string[] };
  attributes: { total: number; samples: string[] };
};

export async function findArabicTaxonomy(): Promise<ArabicTaxPreview> {
  const [b, c, t, a] = await Promise.all([arabicBrands(), arabicCategories(), arabicTags(), arabicAttributes()]);
  const pack = (rows: TaxRow[]) => ({ total: rows.length, samples: rows.slice(0, 8).map((x) => x.nameEn) });
  return { brands: pack(b), categories: pack(c), tags: pack(t), attributes: pack(a) };
}

export type ArabicTaxDeleteResult = { brands: number; categories: number; tags: number; attributes: number; skipped: number };

export async function deleteArabicTaxonomy(): Promise<ArabicTaxDeleteResult> {
  const user = await requirePermission('catalog.write');
  const r: ArabicTaxDeleteResult = { brands: 0, categories: 0, tags: 0, attributes: 0, skipped: 0 };

  for (const x of await arabicBrands()) {
    try { await prisma.product.updateMany({ where: { brandId: x.id }, data: { brandId: null } }); await prisma.brand.delete({ where: { id: x.id } }); r.brands++; }
    catch { r.skipped++; }
  }
  for (const x of await arabicCategories()) {
    try { await prisma.category.updateMany({ where: { parentId: x.id }, data: { parentId: null } }); await prisma.category.delete({ where: { id: x.id } }); r.categories++; } // implicit M2M join rows auto-removed
    catch { r.skipped++; }
  }
  for (const x of await arabicTags()) {
    try { await prisma.tag.delete({ where: { id: x.id } }); r.tags++; } // implicit M2M join rows auto-removed
    catch { r.skipped++; }
  }
  for (const x of await arabicAttributes()) {
    try { await prisma.attribute.delete({ where: { id: x.id } }); r.attributes++; } // values + product links cascade
    catch { r.skipped++; }
  }

  await audit({ actorType: 'USER', actorId: user.id, action: 'cleanup.arabic-taxonomy', entityType: 'Maintenance', entityId: `b:${r.brands} c:${r.categories} t:${r.tags} a:${r.attributes} skip:${r.skipped}` });
  return r;
}
