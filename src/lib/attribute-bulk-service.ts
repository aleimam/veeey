import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { richToText } from '@/lib/rich-text';
import { suggestProductAttributes } from '@/lib/ai';
import { parseAutofillStatus, type AutofillStatus } from '@/lib/attribute-autofill';

/**
 * Bulk attribute editor (owner tool to fill product attributes fast so the PLP
 * filter sidebar has values). Two write paths — assign one value to many
 * selected products, or apply per-product AI suggestions — both respect the
 * attribute's inputType: SINGLE_SELECT replaces any existing value of that
 * attribute on the product; MULTI_SELECT adds without removing others.
 */

export type BulkAttribute = {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string | null;
  multi: boolean;
  isFilterable: boolean;
  values: { id: string; valueEn: string; valueAr: string | null }[];
};

export type BulkProduct = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  brand: string | null;
  image: string | null;
  valueIds: string[]; // this attribute's values currently on the product
};

/** All non-archived attributes with their values — filterable first. */
export async function listBulkAttributes(): Promise<BulkAttribute[]> {
  const rows = await prisma.attribute.findMany({
    where: { archivedAt: null },
    orderBy: [{ isFilterable: 'desc' }, { nameEn: 'asc' }],
    select: {
      id: true, key: true, nameEn: true, nameAr: true, inputType: true, isFilterable: true,
      values: { orderBy: [{ sortOrder: 'asc' }, { valueEn: 'asc' }], select: { id: true, valueEn: true, valueAr: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id, key: a.key, nameEn: a.nameEn, nameAr: a.nameAr,
    multi: a.inputType === 'MULTI_SELECT', isFilterable: a.isFilterable, values: a.values,
  }));
}

export type ProductFilter = { attributeId: string; categoryId?: string; brandId?: string; q?: string; onlyMissing?: boolean; take?: number };

/** Products (with their current values for `attributeId`) matching the filters. */
export async function productsForBulk(f: ProductFilter): Promise<{ items: BulkProduct[]; total: number }> {
  const valueIds = (await prisma.attributeValue.findMany({ where: { attributeId: f.attributeId }, select: { id: true } })).map((v) => v.id);
  const where: Record<string, unknown> = { status: { not: 'ARCHIVED' } }; // Product has no archivedAt — status enum instead
  if (f.categoryId) where.categories = { some: { id: f.categoryId } };
  if (f.brandId) where.brandId = f.brandId;
  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    where.OR = [
      { nameEn: { contains: q, mode: 'insensitive' } },
      { nameAr: { contains: q } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (f.onlyMissing && valueIds.length) {
    where.attributeValues = { none: { attributeValueId: { in: valueIds } } };
  }
  const take = Math.min(f.take ?? 100, 300);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { nameEn: 'asc' },
      take,
      select: {
        id: true, sku: true, nameEn: true, nameAr: true,
        brand: { select: { nameEn: true } },
        images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
        attributeValues: { where: { attributeValueId: { in: valueIds } }, select: { attributeValueId: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  const items: BulkProduct[] = rows.map((p) => ({
    id: p.id, sku: p.sku, nameEn: p.nameEn, nameAr: p.nameAr,
    brand: p.brand?.nameEn ?? null, image: p.images[0]?.url ?? null,
    valueIds: p.attributeValues.map((v) => v.attributeValueId),
  }));
  return { items, total };
}

/** Core write: attach `attributeValueId` to each product, honoring inputType. */
async function applyAssignments(attributeId: string, pairs: { productId: string; attributeValueId: string }[], actorId: string, action: string) {
  if (pairs.length === 0) return { applied: 0 };
  const attr = await prisma.attribute.findUnique({ where: { id: attributeId }, select: { inputType: true, nameEn: true } });
  const single = attr?.inputType !== 'MULTI_SELECT';
  const allValueIds = (await prisma.attributeValue.findMany({ where: { attributeId }, select: { id: true } })).map((v) => v.id);
  const productIds = [...new Set(pairs.map((p) => p.productId))];
  await prisma.$transaction(async (tx) => {
    if (single) {
      // Replace: drop every existing value of this attribute on these products first.
      await tx.productAttributeValue.deleteMany({ where: { productId: { in: productIds }, attributeValueId: { in: allValueIds } } });
    }
    await tx.productAttributeValue.createMany({ data: pairs, skipDuplicates: true });
  });
  await audit({ actorType: 'USER', actorId, action, entityType: 'Attribute', entityId: attributeId, data: { attribute: attr?.nameEn, products: productIds.length, values: pairs.length } });
  return { applied: pairs.length };
}

/** Assign one value to many selected products. */
export async function assignValueToProducts(input: { attributeId: string; attributeValueId: string; productIds: string[] }): Promise<{ applied: number }> {
  const user = await requirePermission('catalog.write');
  const ids = [...new Set(input.productIds)].filter(Boolean);
  if (!input.attributeValueId || ids.length === 0) return { applied: 0 };
  const pairs = ids.map((productId) => ({ productId, attributeValueId: input.attributeValueId }));
  return applyAssignments(input.attributeId, pairs, user.id, 'attribute.bulk.assign');
}

export type AiPick = { productId: string; nameEn: string; brand: string | null; attributeValueId: string; valueEn: string };

/** Ask the AI to suggest a value per product; returns reviewable picks (not applied). */
export async function aiSuggestForProducts(input: { attributeId: string; productIds: string[] }): Promise<{ picks: AiPick[]; aiOff?: boolean }> {
  await requirePermission('catalog.write');
  const attr = await prisma.attribute.findUnique({
    where: { id: input.attributeId },
    select: { nameEn: true, inputType: true, values: { select: { id: true, valueEn: true } } },
  });
  if (!attr) return { picks: [] };
  const ids = [...new Set(input.productIds)].filter(Boolean).slice(0, 60);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, nameEn: true, brand: { select: { nameEn: true } }, shortDescEn: true },
  });
  const suggestions = await suggestProductAttributes({
    attributeName: attr.nameEn,
    allowed: attr.values.map((v) => v.valueEn),
    multi: attr.inputType === 'MULTI_SELECT',
    products: products.map((p) => ({ id: p.id, name: p.nameEn, brand: p.brand?.nameEn, desc: p.shortDescEn ? richToText(p.shortDescEn) : undefined })),
  });
  if (!suggestions) return { picks: [], aiOff: true };
  const valueByName = new Map(attr.values.map((v) => [v.valueEn.toLowerCase(), v]));
  const nameById = new Map(products.map((p) => [p.id, { nameEn: p.nameEn, brand: p.brand?.nameEn ?? null }]));
  const picks: AiPick[] = [];
  for (const s of suggestions) {
    const meta = nameById.get(s.id);
    if (!meta) continue;
    for (const v of s.values ?? []) {
      const av = valueByName.get(v.toLowerCase());
      if (av) picks.push({ productId: s.id, nameEn: meta.nameEn, brand: meta.brand, attributeValueId: av.id, valueEn: av.valueEn });
    }
  }
  return { picks };
}

/** Apply reviewed AI picks (per-product values). */
export async function applyPicks(input: { attributeId: string; pairs: { productId: string; attributeValueId: string }[] }): Promise<{ applied: number }> {
  const user = await requirePermission('catalog.write');
  const pairs = input.pairs.filter((p) => p.productId && p.attributeValueId);
  return applyAssignments(input.attributeId, pairs, user.id, 'attribute.bulk.ai-apply');
}

// ---- One-click auto-fill of ALL filterable attributes (worker job) ----------
// Fills ONLY products missing a value for each filterable attribute — it never
// overwrites values staff already set, and the AI is constrained to the
// attribute's allowed values, so auto-apply is safe. Progress lives in the
// Setting below; the bulk page shows it. Runs in the worker (no session): the
// enqueuing action is RBAC-gated, mirroring the brand-translate job.
const AUTOFILL_STATUS_KEY = 'attributes.autofillJob';

async function setAutofillStatus(v: AutofillStatus) {
  const value = JSON.stringify(v);
  await prisma.setting.upsert({ where: { key: AUTOFILL_STATUS_KEY }, update: { value }, create: { key: AUTOFILL_STATUS_KEY, value } });
}

export async function getAutofillStatus(): Promise<AutofillStatus | null> {
  const row = await prisma.setting.findUnique({ where: { key: AUTOFILL_STATUS_KEY } });
  return parseAutofillStatus(row?.value);
}

type FilterableAttr = { id: string; nameEn: string; multi: boolean; values: { id: string; valueEn: string }[] };

async function filterableAttributes(): Promise<FilterableAttr[]> {
  const rows = await prisma.attribute.findMany({
    where: { archivedAt: null, isFilterable: true },
    orderBy: { nameEn: 'asc' },
    select: { id: true, nameEn: true, inputType: true, values: { select: { id: true, valueEn: true } } },
  });
  return rows
    .filter((a) => a.values.length > 0)
    .map((a) => ({ id: a.id, nameEn: a.nameEn, multi: a.inputType === 'MULTI_SELECT', values: a.values }));
}

/** Per-filterable-attribute count of products still missing a value (for the admin card). */
export async function autofillMissingCounts(): Promise<{ id: string; nameEn: string; missing: number }[]> {
  const attrs = await filterableAttributes();
  return Promise.all(
    attrs.map(async (a) => ({
      id: a.id,
      nameEn: a.nameEn,
      missing: await prisma.product.count({
        where: { status: { not: 'ARCHIVED' }, attributeValues: { none: { attributeValueId: { in: a.values.map((v) => v.id) } } } },
      }),
    })),
  );
}

/** Worker entry: for every filterable attribute, AI-tag all products missing a
 *  value, in batches. Products the AI declines to tag are skipped (not retried). */
export async function runAttributeAutofill(): Promise<AutofillStatus> {
  const attrs = await filterableAttributes();
  const now = () => new Date().toISOString();
  const startedAt = now();
  let scanned = 0;
  let applied = 0;
  let skipped = 0;
  let attrDone = 0;
  const base = () => ({ attrDone, attrTotal: attrs.length, scanned, applied, skipped, startedAt, at: now() });
  await setAutofillStatus({ state: 'running', current: attrs[0]?.nameEn, ...base() });

  const BATCH = 40;
  for (const attr of attrs) {
    const valueIds = attr.values.map((v) => v.id);
    const valueByName = new Map(attr.values.map((v) => [v.valueEn.toLowerCase(), v.id]));
    // Indexed id-cursor pagination: tagged products drop out via the `none`
    // filter; AI-skipped ones stay behind the advancing cursor. (An earlier
    // `notIn: [skipped…]` list grew unbounded on large catalogs.)
    let cursor = '';
    for (;;) {
      const products = await prisma.product.findMany({
        where: {
          status: { not: 'ARCHIVED' },
          id: { gt: cursor },
          attributeValues: { none: { attributeValueId: { in: valueIds } } },
        },
        orderBy: { id: 'asc' },
        take: BATCH,
        select: { id: true, nameEn: true, brand: { select: { nameEn: true } }, shortDescEn: true },
      });
      if (products.length === 0) break;
      cursor = products[products.length - 1].id;
      scanned += products.length;

      const suggestions = await suggestProductAttributes({
        attributeName: attr.nameEn,
        allowed: attr.values.map((v) => v.valueEn),
        multi: attr.multi,
        products: products.map((p) => ({ id: p.id, name: p.nameEn, brand: p.brand?.nameEn, desc: p.shortDescEn ? richToText(p.shortDescEn) : undefined })),
      });
      if (!suggestions) {
        // AI off / call failed — fatal on the very first batch, otherwise stop this run cleanly.
        const fatal = applied === 0 && skipped === 0 && scanned === products.length;
        const status: AutofillStatus = { state: fatal ? 'error' : 'done', ...base(), error: 'AI unavailable' };
        await setAutofillStatus(status);
        return status;
      }

      const byId = new Map(suggestions.map((s) => [s.id, s.values ?? []]));
      const pairs: { productId: string; attributeValueId: string }[] = [];
      for (const p of products) {
        const values = byId.get(p.id) ?? [];
        const picked = (attr.multi ? values : values.slice(0, 1))
          .map((v) => valueByName.get(v.toLowerCase()))
          .filter((id): id is string => !!id);
        if (picked.length === 0) {
          skipped += 1; // stays behind the cursor — not retried this run
        } else {
          for (const id of picked) pairs.push({ productId: p.id, attributeValueId: id });
        }
      }
      if (pairs.length) {
        await prisma.productAttributeValue.createMany({ data: pairs, skipDuplicates: true });
        applied += pairs.length;
      }
      await setAutofillStatus({ state: 'running', current: attr.nameEn, ...base() });
    }
    attrDone += 1;
    await setAutofillStatus({ state: 'running', current: attr.nameEn, ...base() });
  }

  const status: AutofillStatus = { state: 'done', ...base() };
  await setAutofillStatus(status);
  await audit({ actorType: 'SYSTEM', action: 'attribute.autofill.run', entityType: 'Attribute', entityId: `${applied} applied`, data: { attrTotal: attrs.length, scanned, applied, skipped } });
  return status;
}
