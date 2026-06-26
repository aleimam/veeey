import { prisma } from '@/lib/prisma';
import { wooFetch } from '@/lib/woocommerce';
import { nameImportable } from './wc-transform';
import { slugify, brandCode, skuFromParts } from '@/lib/sku';
import { ensureCustomerProfile } from '@/lib/customer';
import { normalizeMobile } from '@/lib/provider-config';
import type { OrderStatus, PaymentMethod, Prisma } from '@/generated/prisma/client';

/**
 * WooCommerce → Veeey live sync (egyptvitamins.com). Incremental, idempotent
 * upserts keyed on `legacyWpId`. Conflict policy = "protect Veeey edits": a record
 * syncs until it's edited in Veeey (`updatedAt` drifts past `syncedAt`), then it
 * detaches and sync skips it. New products land PRIVATE/draft.
 *
 * Core functions are permission-free so the scheduler/webhooks can call them;
 * RBAC + audit live in the admin actions. Products & orders pull incrementally
 * via `modified_after`; customers lack a modified filter in the WC REST API so
 * they're a bounded re-scan (idempotent) — best for the initial full pull.
 */

export type SyncSummary = {
  entity: string;
  scanned: number;
  created: number;
  updated: number;
  detached: number;
  skipped: number;
  errors: number;
  sampleErrors: { key: string; detail: string }[];
  sampleSkips: { name: string; reason: string }[];
  cursor: string | null;
};

const str = (v: unknown): string => (v == null ? '' : typeof v === 'object' ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const DETACH_MS = 3000;

// Per-run soft time budget — the loop saves progress after every page, so even if
// a run is cut short (budget, upstream timeout, or a proxy 504) no work is lost
// and the next "Sync now" resumes from the saved cursor. This is what makes a
// full backfill of ~20k customers safe across repeated clicks / scheduled runs.
const BUDGET_MS = 120_000;
const FETCH_MS = 45_000;
// `_fields` slims the WooCommerce payload to only what we map — critical for the
// heavy products endpoint, which otherwise times out on full responses.
const PRODUCT_FIELDS = 'id,name,sku,regular_price,price,description,short_description,weight,global_unique_id,status,categories,brands,attributes,images,date_modified,date_modified_gmt';
const ORDER_FIELDS = 'id,number,status,total,discount_total,shipping_total,payment_method,customer_id,billing,shipping,line_items,date_created,date_created_gmt,date_modified,date_modified_gmt';
const CUSTOMER_FIELDS = 'id,email,first_name,last_name,username,billing,date_created';

function egpToPiastres(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
const newSummary = (entity: string, cursor: string | null): SyncSummary => ({ entity, scanned: 0, created: 0, updated: 0, detached: 0, skipped: 0, errors: 0, sampleErrors: [], sampleSkips: [], cursor });
function pushErr(s: SyncSummary, key: string, detail: string) {
  s.errors++;
  if (s.sampleErrors.length < 10) s.sampleErrors.push({ key, detail });
}
function pushSkip(s: SyncSummary, name: string, reason: string) {
  s.skipped++;
  if (s.sampleSkips.length < 12) s.sampleSkips.push({ name: name.slice(0, 80), reason });
}
async function saveState(entity: string, cursor: string | null, s: SyncSummary) {
  const result = { scanned: s.scanned, created: s.created, updated: s.updated, detached: s.detached, skipped: s.skipped, errors: s.errors, skips: s.sampleSkips.slice(0, 10), at: new Date().toISOString() };
  await prisma.wooSyncState.upsert({
    where: { entity },
    update: { cursor, lastRunAt: new Date(), lastResult: result },
    create: { entity, cursor, lastRunAt: new Date(), lastResult: result },
  });
}

// ── Products ────────────────────────────────────────────────────────────────
async function findOrCreateBrand(name: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  const slug = slugify(n) || 'brand';
  const existing = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
  return existing ? existing.id : (await prisma.brand.create({ data: { slug, nameEn: n, legacyName: n } })).id;
}
async function findOrCreateCategory(name: string, wcSlug: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  const slug = (wcSlug || slugify(n)) || 'category';
  const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  return existing ? existing.id : (await prisma.category.create({ data: { slug, nameEn: n } })).id;
}
function extractBrand(p: Record<string, unknown>): string {
  const brands = arr(p.brands);
  if (brands.length) return str(obj(brands[0]).name);
  for (const a of arr(p.attributes)) {
    const ao = obj(a);
    if (str(ao.name).toLowerCase().includes('brand') || str(ao.name).includes('علامة')) {
      const opts = arr(ao.options);
      if (opts.length) return str(opts[0]);
    }
  }
  return '';
}
async function uniqueProductSlug(base: string, wpId: number): Promise<string> {
  const slug = slugify(base) || `product-${wpId}`;
  const clash = await prisma.product.findFirst({ where: { slugEn: slug, legacyWpId: { not: wpId } }, select: { id: true } });
  return clash ? `${slug}-${wpId}` : slug;
}
function imagesData(productId: string, p: Record<string, unknown>) {
  return arr(p.images).slice(0, 12).map((im, i) => ({ productId, url: str(obj(im).src), alt: str(obj(im).alt) || null, sortOrder: i, isPrimary: i === 0 })).filter((x) => x.url);
}

export async function syncProducts(opts: { maxPages?: number; perPage?: number; budgetMs?: number } = {}): Promise<SyncSummary> {
  const maxPages = Math.min(opts.maxPages ?? 5, 200);
  const perPage = opts.perPage ?? 100;
  const deadline = Date.now() + (opts.budgetMs ?? BUDGET_MS);
  const state = await prisma.wooSyncState.findUnique({ where: { entity: 'products' } });
  const cursor = state?.cursor ?? null;
  const s = newSummary('products', cursor);
  let newCursor = cursor;
  const baseParams: Record<string, string | number> = { per_page: perPage, orderby: 'modified', order: 'asc', _fields: PRODUCT_FIELDS };
  if (cursor) baseParams.modified_after = cursor;

  let page = 1;
  let totalPages = 1;
  while (page <= Math.min(maxPages, totalPages)) {
    if (Date.now() > deadline) break;
    let res: Awaited<ReturnType<typeof wooFetch>>;
    try {
      res = await wooFetch('products', { ...baseParams, page }, FETCH_MS);
    } catch (e) {
      pushErr(s, `page ${page}`, e instanceof Error ? e.message.slice(0, 140) : 'fetch failed');
      break; // keep progress saved from prior pages; next run resumes from the cursor
    }
    totalPages = res.totalPages;
    const items = res.data as Record<string, unknown>[];
    if (items.length === 0) break;
    for (const p of items) {
      s.scanned++;
      const wpId = Number(p.id);
      const modified = str(p.date_modified_gmt) || str(p.date_modified);
      if (modified && (!newCursor || modified > newCursor)) newCursor = modified;
      try {
        // Quality gate: skip Arabic-only names, open/damaged/broken items, and
        // junk/placeholder names. Checked before any DB write so they're never
        // created or updated.
        const pname = str(p.name);
        const verdict = nameImportable(pname);
        if (!verdict.ok) { pushSkip(s, pname || str(p.id), verdict.reason); continue; }
        const price = egpToPiastres(p.regular_price ?? p.price);
        if (!Number.isFinite(wpId) || price == null) { pushErr(s, str(p.id), 'invalid id / price'); continue; }
        const existing = await prisma.product.findUnique({ where: { legacyWpId: wpId }, select: { id: true, syncedAt: true, updatedAt: true } });
        if (existing?.syncedAt && existing.updatedAt.getTime() - existing.syncedAt.getTime() > DETACH_MS) { s.detached++; continue; }

        const brandName = extractBrand(p);
        const brandId = await findOrCreateBrand(brandName);
        const catIds: string[] = [];
        for (const c of arr(p.categories).slice(0, 4)) {
          const id = await findOrCreateCategory(str(obj(c).name), str(obj(c).slug));
          if (id) catIds.push(id);
        }
        const wG = Number(p.weight); // egyptvitamins.com stores weight in grams already
        const weightG = str(p.weight) !== '' && Number.isFinite(wG) ? Math.round(wG) : null;
        const common = {
          nameEn: str(p.name) || `Product ${wpId}`,
          longDescEn: str(p.description) || null,
          shortDescEn: str(p.short_description) || null,
          basePricePiastres: BigInt(price),
          weightG,
          gtin: str(p.global_unique_id) || null,
          brandId,
          syncedAt: new Date(),
        };
        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data: { ...common, categories: { set: catIds.map((id) => ({ id })) } } });
          await prisma.productImage.deleteMany({ where: { productId: existing.id } });
          const imgs = imagesData(existing.id, p);
          if (imgs.length) await prisma.productImage.createMany({ data: imgs });
          s.updated++;
        } else {
          const created = await prisma.product.create({
            data: { ...common, sku: skuFromParts(brandCode(brandName || 'GEN'), wpId), legacyWpId: wpId, legacySku: str(p.sku) || null, slugEn: await uniqueProductSlug(str(p.name), wpId), status: 'PRIVATE', kind: 'SUPPLEMENT', categories: { connect: catIds.map((id) => ({ id })) } },
            select: { id: true },
          });
          const imgs = imagesData(created.id, p);
          if (imgs.length) await prisma.productImage.createMany({ data: imgs });
          s.created++;
        }
      } catch (e) {
        pushErr(s, str(p.id), e instanceof Error ? e.message.slice(0, 140) : 'error');
      }
    }
    s.cursor = newCursor;
    await saveState('products', newCursor, s); // persist progress per page — survives timeout/504
    page++;
  }
  s.cursor = newCursor;
  await saveState('products', newCursor, s);
  return s;
}

// ── Customers ─────────────────────────────────────────────────────────────
export async function syncCustomers(opts: { maxPages?: number; perPage?: number; budgetMs?: number } = {}): Promise<SyncSummary> {
  const maxPages = Math.min(opts.maxPages ?? 5, 400);
  const perPage = opts.perPage ?? 100;
  const deadline = Date.now() + (opts.budgetMs ?? BUDGET_MS);
  // WooCommerce has no "modified since" filter for customers, so we paginate by a
  // stable id-ascending order and store the last completed page as the cursor —
  // this lets repeated runs (or the scheduler) drain all customers instead of
  // re-scanning the first N forever. On reaching the end we reset to null so the
  // next run re-scans from the top to pick up newly-registered customers.
  const state = await prisma.wooSyncState.findUnique({ where: { entity: 'customers' } });
  const startPage = state?.cursor ? Math.max(1, Number(state.cursor) + 1) : 1;
  const s = newSummary('customers', state?.cursor ?? null);
  let lastCompleted: number | null = state?.cursor ? Number(state.cursor) : null;

  let page = startPage;
  let pagesThisRun = 0;
  while (pagesThisRun < maxPages) {
    if (Date.now() > deadline) break;
    let res: Awaited<ReturnType<typeof wooFetch>>;
    try {
      res = await wooFetch('customers', { per_page: perPage, orderby: 'id', order: 'asc', _fields: CUSTOMER_FIELDS, page }, FETCH_MS);
    } catch (e) {
      pushErr(s, `page ${page}`, e instanceof Error ? e.message.slice(0, 140) : 'fetch failed');
      break;
    }
    const totalPages = res.totalPages;
    const items = res.data as Record<string, unknown>[];
    if (items.length === 0) { lastCompleted = null; break; } // past the end → reset for next full re-scan
    for (const c of items) {
      s.scanned++;
      const wpId = Number(c.id);
      const email = str(c.email).trim().toLowerCase();
      try {
        if (!email || !Number.isFinite(wpId)) { pushErr(s, str(c.id), 'missing email/id'); continue; }
        const existing = await prisma.customer.findUnique({ where: { legacyWpId: wpId }, select: { id: true, syncedAt: true, updatedAt: true } });
        if (existing?.syncedAt && existing.updatedAt.getTime() - existing.syncedAt.getTime() > DETACH_MS) { s.detached++; continue; }
        if (existing) {
          await prisma.customer.update({ where: { id: existing.id }, data: { firstName: str(c.first_name) || null, lastName: str(c.last_name) || null, syncedAt: new Date() } });
          s.updated++;
          continue;
        }
        const userByEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (userByEmail) { s.skipped++; continue; } // don't merge into an existing Veeey account

        const billing = obj(c.billing);
        const phoneRaw = normalizeMobile(str(billing.phone));
        const phone = phoneRaw && !(await prisma.user.findFirst({ where: { phone: phoneRaw }, select: { id: true } })) ? phoneRaw : null;
        const name = `${str(c.first_name)} ${str(c.last_name)}`.trim() || null;
        const user = await prisma.user.create({ data: { email, name, phone }, select: { id: true } });
        await ensureCustomerProfile(user.id);
        const cust = await prisma.customer.update({ where: { userId: user.id }, data: { firstName: str(c.first_name) || null, lastName: str(c.last_name) || null, legacyWpId: wpId, syncedAt: new Date() }, select: { id: true } });
        if (str(billing.city)) {
          await prisma.address.create({ data: { customerId: cust.id, governorate: str(billing.state) || '—', city: str(billing.city), area: str(billing.address_2) || str(billing.city), street: str(billing.address_1) || null, phone, isDefaultShipping: true, isDefaultBilling: true } });
        }
        s.created++;
      } catch (e) {
        pushErr(s, str(c.id), e instanceof Error ? e.message.slice(0, 140) : 'error');
      }
    }
    lastCompleted = page;
    pagesThisRun++;
    await saveState('customers', String(lastCompleted), s); // persist page cursor per page
    if (page >= totalPages || items.length < perPage) { lastCompleted = null; break; } // reached the end → reset
    page++;
  }
  s.cursor = lastCompleted == null ? null : String(lastCompleted);
  await saveState('customers', s.cursor, s);
  return s;
}

// ── Orders ────────────────────────────────────────────────────────────────
const ORDER_STATUS: Record<string, OrderStatus> = {
  pending: 'PENDING_CONFIRMATION', processing: 'PROCESSING', 'on-hold': 'HOLD', completed: 'CASH_DELIVERED', cancelled: 'CANCELLED', refunded: 'REFUNDED', failed: 'FAILED',
};
function mapPayment(method: string): PaymentMethod | null {
  const m = method.toLowerCase();
  if (m.includes('cod') || m.includes('cash')) return 'COD';
  if (m.includes('bacs') || m.includes('bank')) return 'BANK_TRANSFER';
  return null;
}
async function uniqueOrderNumber(base: string, wpId: number): Promise<string> {
  const num = base || String(wpId);
  const clash = await prisma.order.findFirst({ where: { number: num, legacyWpId: { not: wpId } }, select: { id: true } });
  return clash ? `${num}-WC${wpId}` : num;
}

export async function syncOrders(opts: { maxPages?: number; perPage?: number; budgetMs?: number } = {}): Promise<SyncSummary> {
  const maxPages = Math.min(opts.maxPages ?? 5, 200);
  const perPage = opts.perPage ?? 50;
  const deadline = Date.now() + (opts.budgetMs ?? BUDGET_MS);
  const state = await prisma.wooSyncState.findUnique({ where: { entity: 'orders' } });
  const cursor = state?.cursor ?? null;
  const s = newSummary('orders', cursor);
  let newCursor = cursor;
  const baseParams: Record<string, string | number> = { per_page: perPage, orderby: 'modified', order: 'asc', _fields: ORDER_FIELDS };
  if (cursor) baseParams.modified_after = cursor;

  let page = 1;
  let totalPages = 1;
  while (page <= Math.min(maxPages, totalPages)) {
    if (Date.now() > deadline) break;
    let res: Awaited<ReturnType<typeof wooFetch>>;
    try {
      res = await wooFetch('orders', { ...baseParams, page }, FETCH_MS);
    } catch (e) {
      pushErr(s, `page ${page}`, e instanceof Error ? e.message.slice(0, 140) : 'fetch failed');
      break;
    }
    totalPages = res.totalPages;
    const items = res.data as Record<string, unknown>[];
    if (items.length === 0) break;
    for (const o of items) {
      s.scanned++;
      const wpId = Number(o.id);
      const modified = str(o.date_modified_gmt) || str(o.date_modified);
      if (modified && (!newCursor || modified > newCursor)) newCursor = modified;
      try {
        const total = egpToPiastres(o.total);
        if (!Number.isFinite(wpId) || total == null) { pushErr(s, str(o.id), 'invalid id / total'); continue; }
        const existing = await prisma.order.findUnique({ where: { legacyWpId: wpId }, select: { id: true, syncedAt: true, updatedAt: true } });
        if (existing?.syncedAt && existing.updatedAt.getTime() - existing.syncedAt.getTime() > DETACH_MS) { s.detached++; continue; }

        const billing = obj(o.billing);
        const wcCustomerId = Number(o.customer_id ?? 0);
        const cust = wcCustomerId ? await prisma.customer.findUnique({ where: { legacyWpId: wcCustomerId }, select: { id: true } }) : null;
        const shipping = egpToPiastres(o.shipping_total) ?? 0;
        const discount = egpToPiastres(o.discount_total) ?? 0;
        const data = {
          status: ORDER_STATUS[str(o.status)] ?? ('PROCESSING' as OrderStatus),
          paymentMethod: mapPayment(str(o.payment_method)),
          subtotalPiastres: BigInt(Math.max(0, total + discount - shipping)),
          discountPiastres: BigInt(discount),
          shippingPiastres: BigInt(shipping),
          totalPiastres: BigInt(total),
          shippingAddressJson: { billing, shipping: obj(o.shipping) } as Prisma.InputJsonValue,
          customerId: cust?.id ?? null,
          guestEmail: cust ? null : str(billing.email) || null,
          syncedAt: new Date(),
        };
        if (existing) {
          await prisma.order.update({ where: { id: existing.id }, data });
          s.updated++;
        } else {
          const created = await prisma.order.create({
            data: { ...data, number: await uniqueOrderNumber(str(o.number), wpId), legacyWpId: wpId, placedAt: new Date(str(o.date_created) || str(o.date_created_gmt) || Date.now()) },
            select: { id: true },
          });
          for (const li of arr(o.line_items)) {
            const lo = obj(li);
            const prod = await prisma.product.findUnique({ where: { legacyWpId: Number(lo.product_id) }, select: { id: true } });
            if (!prod) continue;
            await prisma.orderItem.create({ data: { orderId: created.id, productId: prod.id, qty: Math.max(1, Number(lo.quantity) || 1), unitPricePiastres: BigInt(egpToPiastres(lo.price) ?? 0) } });
          }
          s.created++;
        }
      } catch (e) {
        pushErr(s, str(o.id), e instanceof Error ? e.message.slice(0, 140) : 'error');
      }
    }
    s.cursor = newCursor;
    await saveState('orders', newCursor, s); // persist progress per page
    page++;
  }
  s.cursor = newCursor;
  await saveState('orders', newCursor, s);
  return s;
}

export async function getSyncState(entity: string) {
  return prisma.wooSyncState.findUnique({ where: { entity } });
}

/** Run enabled entities — used by the scheduler/webhook. Products → customers → orders. */
export async function syncEntity(entity: 'products' | 'customers' | 'orders', opts: { maxPages?: number } = {}): Promise<SyncSummary> {
  if (entity === 'products') return syncProducts(opts);
  if (entity === 'customers') return syncCustomers(opts);
  return syncOrders(opts);
}

/** Read a `woo.sync.*` flag directly (no auth chain — safe for the worker). */
async function flag(key: string, def: boolean): Promise<boolean> {
  const r = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  return r ? r.value !== 'false' : def;
}

/** Scheduler entry: runs the enabled entities (bounded chunk + per-entity time
 * budget). Off by default. With per-page state saves this steadily drains a large
 * backlog hands-off across the recurring runs. */
export async function runScheduledSync(maxPages = 20): Promise<SyncSummary[]> {
  if (!(await flag('woo.sync.enabled', false))) return [];
  const budgetMs = 45_000;
  const out: SyncSummary[] = [];
  if (await flag('woo.sync.products', true)) out.push(await syncProducts({ maxPages, budgetMs }));
  if (await flag('woo.sync.customers', true)) out.push(await syncCustomers({ maxPages, budgetMs }));
  if (await flag('woo.sync.orders', true)) out.push(await syncOrders({ maxPages, budgetMs }));
  return out;
}
