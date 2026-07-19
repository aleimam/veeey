/**
 * Contract v2 — products & customers channel, Veeey-side obligations (§7 of
 * INTEGRATION_V2_PRODUCTS_CUSTOMERS.md; supersedes v1 §4.2 for these payloads).
 *
 *  - Canonical SKU: numeric product id (legacyWpId when present, else minted
 *    from `integration_sku_seq`), variations `base-N`, IMMUTABLE once assigned
 *    (stored on Product.integrationSku; the storefront VEY- sku is untouched).
 *  - Payload: sku, legacyWpId, name (variations distinct via variant axes),
 *    type (SUPPLEMENT | DEVICE | INJECTION = Product.kind), photoUrls (absolute,
 *    ≤6), archived (hard-delete only). v1's `estimatedWeight` and
 *    `defaultSupplierName` are DROPPED — weight + supplier are YeldnIN-owned.
 *  - Customers: registered only (guests never get a Customer row in Veeey, so
 *    every Customer IS registered); veeeyCustomerId = Customer.id.
 *  - Emitters fire on create/update; a nightly sweep re-pushes everything
 *    (idempotent upserts heal drift). §6: the wpId-keyed /catalog channel keeps
 *    running unchanged alongside until cutover.
 *
 * GATING: everything here no-ops unless BOTH the v1 master switch
 * (integration.enabled / INTEGRATION_ENABLED) AND the NEW Setting
 * `integration.v2.enabled` are on. The v2 gate ships OFF — YeldnIN's
 * /products/upsert + /customers/upsert endpoints deploy separately; arming is
 * an explicit owner/ops step after both sides exist (contract is still DRAFT).
 */
import { prisma } from '@/lib/prisma';

export type ProductWireV2 = {
  sku: string;
  legacyWpId?: number;
  name: string;
  type: string; // SUPPLEMENT | DEVICE | INJECTION
  photoUrls?: string[];
  archived?: boolean;
};

export type CustomerWireV2 = {
  veeeyCustomerId: string;
  name: string;
  phone?: string;
  archived?: boolean;
};

/** Is the v2 channel armed? (Setting `integration.v2.enabled` = '1'/'true'.) */
export async function v2Enabled(): Promise<boolean> {
  const { integrationEnabled } = await import('@/lib/integration/config');
  if (!(await integrationEnabled())) return false;
  const row = await prisma.setting.findUnique({ where: { key: 'integration.v2.enabled' } }).catch(() => null);
  const v = (row?.value ?? '').toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

// ---------- pure helpers (unit-tested) --------------------------------------

/** Distinct variation name: base name + the variant's axis values (contract §1
 *  "variations must carry distinct names"). PURE. */
export function distinctVariationName(nameEn: string, variantJson: unknown): string {
  if (!variantJson || typeof variantJson !== 'object') return nameEn;
  const vals: string[] = [];
  for (const v of Object.values(variantJson as Record<string, unknown>)) {
    const en = v && typeof v === 'object' ? (v as { en?: unknown }).en : null;
    if (typeof en === 'string' && en.trim()) vals.push(en.trim());
  }
  if (!vals.length) return nameEn;
  const suffix = vals.join(' / ');
  return nameEn.toLowerCase().includes(suffix.toLowerCase()) ? nameEn : `${nameEn} — ${suffix}`;
}

/** Absolute https photo URLs, ≤6 (contract §1). Relative /uploads paths get the
 *  site origin prefixed. PURE. */
export function absolutePhotoUrls(urls: string[], siteOrigin: string): string[] {
  const origin = siteOrigin.replace(/\/$/, '');
  return urls
    .map((u) => (u.startsWith('http') ? u : u.startsWith('/') ? `${origin}${u}` : ''))
    .filter((u) => u.startsWith('https://') || u.startsWith('http://'))
    .slice(0, 6);
}

// ---------- canonical SKU (immutable, DB-backed) ----------------------------

/**
 * Assign-once canonical SKU:
 *  1. already assigned → return it (immutability);
 *  2. legacyWpId → that number;
 *  3. member of a variant group with a numbered sibling → `base-N` (next free N);
 *  4. else → minted from integration_sku_seq (starts 900000, above the WP range).
 */
export async function ensureIntegrationSku(productId: string): Promise<string> {
  const p = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { id: true, integrationSku: true, legacyWpId: true, variantGroupId: true },
  });
  if (p.integrationSku) return p.integrationSku;

  let sku: string | null = null;
  if (p.legacyWpId != null) {
    sku = String(p.legacyWpId);
  } else if (p.variantGroupId) {
    const siblings = await prisma.product.findMany({
      where: { variantGroupId: p.variantGroupId, id: { not: p.id } },
      select: { integrationSku: true, legacyWpId: true },
    });
    // The group's base number = any sibling's numeric root.
    const roots = siblings
      .map((s) => (s.integrationSku ?? (s.legacyWpId != null ? String(s.legacyWpId) : null)))
      .filter((x): x is string => !!x)
      .map((x) => x.split('-')[0]);
    const base = roots[0] ?? null;
    if (base) {
      const used = new Set(siblings.map((s) => s.integrationSku).filter((x): x is string => !!x));
      let n = 1;
      while (used.has(`${base}-${n}`)) n++;
      sku = `${base}-${n}`;
    }
  }
  if (!sku) {
    const rows = await prisma.$queryRaw<Array<{ v: bigint }>>`SELECT nextval('integration_sku_seq') AS v`;
    sku = String(rows[0].v);
  }
  await prisma.product.update({ where: { id: p.id }, data: { integrationSku: sku } });
  return sku;
}

// ---------- wire builders ---------------------------------------------------

type ProductForWire = {
  id: string;
  integrationSku: string | null;
  legacyWpId: number | null;
  nameEn: string;
  kind: string;
  variantGroupId: string | null;
  variantJson: unknown;
  images: { url: string }[];
};

const PRODUCT_WIRE_SELECT = {
  id: true, integrationSku: true, legacyWpId: true, nameEn: true, kind: true,
  variantGroupId: true, variantJson: true,
  images: { select: { url: true }, orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }], take: 6 },
};

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://veeey.com';
}

/** Build the §1 payload. Deliberately NO estimatedWeight / defaultSupplierName
 *  (dropped from v1 §4.2 — YeldnIN owns weight + supplier). */
export function productToWireV2(p: ProductForWire, sku: string, archived = false): ProductWireV2 {
  const photos = absolutePhotoUrls(p.images.map((i) => i.url), siteOrigin());
  return {
    sku,
    ...(p.legacyWpId != null ? { legacyWpId: p.legacyWpId } : {}),
    name: p.variantGroupId ? distinctVariationName(p.nameEn, p.variantJson) : p.nameEn,
    type: p.kind,
    ...(photos.length ? { photoUrls: photos } : {}),
    ...(archived ? { archived: true } : {}),
  };
}

export function customerToWireV2(c: { id: string; firstName: string | null; lastName: string | null; user: { name: string | null; phone: string | null } }, archived = false): CustomerWireV2 {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.user.name || 'Veeey customer';
  return {
    veeeyCustomerId: c.id,
    name,
    ...(c.user.phone ? { phone: c.user.phone } : {}),
    ...(archived ? { archived: true } : {}),
  };
}

// ---------- emitters (best-effort; callers never fail on sync errors) -------

export async function emitProductUpsertV2(productId: string, opts: { archived?: boolean } = {}): Promise<void> {
  try {
    if (!(await v2Enabled())) return;
    const p = await prisma.product.findUnique({ where: { id: productId }, select: PRODUCT_WIRE_SELECT });
    if (!p) return;
    const sku = await ensureIntegrationSku(p.id);
    const { recordOutbox } = await import('@/lib/integration/integration-service');
    await recordOutbox('products.upsert', sku, productToWireV2(p, sku, opts.archived ?? false));
  } catch (e) {
    console.error('emitProductUpsertV2 failed', e);
  }
}

export async function emitCustomerUpsertV2(customerId: string, opts: { archived?: boolean } = {}): Promise<void> {
  try {
    if (!(await v2Enabled())) return;
    const c = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, firstName: true, lastName: true, user: { select: { name: true, phone: true } } },
    });
    if (!c) return;
    const { recordOutbox } = await import('@/lib/integration/integration-service');
    await recordOutbox('customers.upsert', c.id, customerToWireV2(c, opts.archived ?? false));
  } catch (e) {
    console.error('emitCustomerUpsertV2 failed', e);
  }
}

// ---------- nightly full sweep (contract §5 safety net) ---------------------

export async function sweepV2(): Promise<{ products: number; customers: number }> {
  if (!(await v2Enabled())) return { products: 0, customers: 0 };
  const { recordOutbox } = await import('@/lib/integration/integration-service');
  let products = 0;
  let customers = 0;

  // Full catalog (ARCHIVED products excluded — a Veeey archive was already
  // pushed as archived:true at delete time; unpublished stays included: publish
  // state is Veeey-internal and never synced, contract §0/§4).
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.product.findMany({
      where: { status: { not: 'ARCHIVED' } },
      select: PRODUCT_WIRE_SELECT,
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    for (const p of batch) {
      const sku = await ensureIntegrationSku(p.id);
      await recordOutbox('products.upsert', sku, productToWireV2(p, sku));
      products++;
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < 500) break;
  }

  // All registered customers (guests never have Customer rows).
  cursor = undefined;
  for (;;) {
    const batch: Array<{ id: string; firstName: string | null; lastName: string | null; user: { name: string | null; phone: string | null } }> =
      await prisma.customer.findMany({
        select: { id: true, firstName: true, lastName: true, user: { select: { name: true, phone: true } } },
        orderBy: { id: 'asc' },
        take: 1000,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
    if (!batch.length) break;
    for (const c of batch) {
      await recordOutbox('customers.upsert', c.id, customerToWireV2(c));
      customers++;
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < 1000) break;
  }
  return { products, customers };
}
