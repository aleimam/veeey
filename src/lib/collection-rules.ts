import type { Prisma } from '@/generated/prisma/client';

/**
 * Pure condition builder for automatic collections (V3-COL-4). A rule is a match
 * mode (ALL/ANY) + a list of conditions over Category / Tag / Brand / Product
 * Attribute value / Price range / Stock. `buildRuleWhere` compiles it to a
 * Prisma Product where-clause; the caller adds visibility (PUBLISHED, in-stock/
 * pre-order). No DB access here → fully unit-testable.
 */
export type MatchMode = 'ALL' | 'ANY';

export type RuleCondition =
  | { field: 'category'; op: 'is' | 'is_not'; value: string }        // category id
  | { field: 'tag'; op: 'is' | 'is_not'; value: string }            // tag id
  | { field: 'brand'; op: 'is' | 'is_not'; value: string }          // brand id
  | { field: 'attribute'; op: 'is' | 'is_not'; value: string }      // attributeValue id
  | { field: 'name'; op: 'contains' | 'not_contains'; value: string } // free text vs name (EN/AR) + SKU
  | { field: 'price'; op: 'gt' | 'lt' | 'between'; value: number; value2?: number } // EGP
  | { field: 'stock'; op: 'in_stock' | 'out_of_stock' };

export type RuleSort = 'featured' | 'bestselling' | 'newest' | 'price_asc' | 'price_desc';
export type RuleConfig = { match: MatchMode; conditions: RuleCondition[]; sort?: RuleSort };

export const EMPTY_RULE: RuleConfig = { match: 'ALL', conditions: [] };

const SORTS = new Set<RuleSort>(['featured', 'bestselling', 'newest', 'price_asc', 'price_desc']);

/** Product order-by for a rule's sort (default = featured, i.e. most-reviewed). */
export function ruleOrderBy(sort: RuleSort | undefined): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case 'bestselling': return { orderItems: { _count: 'desc' } };
    case 'newest': return { createdAt: 'desc' };
    case 'price_asc': return { basePricePiastres: 'asc' };
    case 'price_desc': return { basePricePiastres: 'desc' };
    default: return { ratingCount: 'desc' };
  }
}

const inStockWhere: Prisma.ProductWhereInput = { lots: { some: { status: 'LIVE', qtyOnHand: { gt: 0 } } } };
const egpToPiastres = (egp: number): bigint => BigInt(Math.round(egp * 100));

/** Compile a single condition to a partial where, or null if incomplete. */
export function conditionWhere(c: RuleCondition): Prisma.ProductWhereInput | null {
  switch (c.field) {
    case 'category': {
      if (!c.value) return null;
      const w: Prisma.ProductWhereInput = { categories: { some: { id: c.value } } };
      return c.op === 'is_not' ? { NOT: w } : w;
    }
    case 'tag': {
      if (!c.value) return null;
      const w: Prisma.ProductWhereInput = { tags: { some: { id: c.value } } };
      return c.op === 'is_not' ? { NOT: w } : w;
    }
    case 'brand': {
      if (!c.value) return null;
      return c.op === 'is_not' ? { NOT: { brandId: c.value } } : { brandId: c.value };
    }
    case 'attribute': {
      if (!c.value) return null;
      const w: Prisma.ProductWhereInput = { attributeValues: { some: { attributeValueId: c.value } } };
      return c.op === 'is_not' ? { NOT: w } : w;
    }
    case 'name': {
      const v = c.value.trim();
      if (!v) return null;
      // Free-text match against the bilingual name + SKU (case-insensitive).
      const w: Prisma.ProductWhereInput = {
        OR: [
          { nameEn: { contains: v, mode: 'insensitive' } },
          { nameAr: { contains: v, mode: 'insensitive' } },
          { sku: { contains: v, mode: 'insensitive' } },
        ],
      };
      return c.op === 'not_contains' ? { NOT: w } : w;
    }
    case 'price': {
      if (c.op === 'between') {
        if (c.value == null || c.value2 == null) return null;
        const [lo, hi] = c.value <= c.value2 ? [c.value, c.value2] : [c.value2, c.value];
        return { basePricePiastres: { gte: egpToPiastres(lo), lte: egpToPiastres(hi) } };
      }
      if (c.value == null) return null;
      return { basePricePiastres: c.op === 'gt' ? { gt: egpToPiastres(c.value) } : { lt: egpToPiastres(c.value) } };
    }
    case 'stock':
      return c.op === 'out_of_stock' ? { NOT: inStockWhere } : inStockWhere;
    default:
      return null;
  }
}

/** Compile a whole rule to a Product where-clause (empty = match everything). */
export function buildRuleWhere(rule: RuleConfig): Prisma.ProductWhereInput {
  const parts = rule.conditions.map(conditionWhere).filter((w): w is Prisma.ProductWhereInput => w !== null);
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return rule.match === 'ANY' ? { OR: parts } : { AND: parts };
}

const FIELDS = new Set(['category', 'tag', 'brand', 'attribute', 'name', 'price', 'stock']);

/** Coerce arbitrary stored/submitted JSON into a safe RuleConfig. */
export function parseRule(raw: unknown): RuleConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const match: MatchMode = r.match === 'ANY' ? 'ANY' : 'ALL';
  const sort = SORTS.has(r.sort as RuleSort) ? (r.sort as RuleSort) : undefined;
  const rawConds = Array.isArray(r.conditions) ? r.conditions : [];
  const conditions: RuleCondition[] = [];
  for (const cu of rawConds) {
    const c = (cu && typeof cu === 'object' ? cu : {}) as Record<string, unknown>;
    const field = String(c.field ?? '');
    if (!FIELDS.has(field)) continue;
    const op = String(c.op ?? '');
    if (field === 'price') {
      if (!['gt', 'lt', 'between'].includes(op)) continue;
      const value = Number(c.value);
      if (!Number.isFinite(value)) continue;
      const cond: RuleCondition = { field: 'price', op: op as 'gt' | 'lt' | 'between', value };
      if (op === 'between') {
        const value2 = Number(c.value2);
        if (!Number.isFinite(value2)) continue;
        cond.value2 = value2;
      }
      conditions.push(cond);
    } else if (field === 'stock') {
      if (!['in_stock', 'out_of_stock'].includes(op)) continue;
      conditions.push({ field: 'stock', op: op as 'in_stock' | 'out_of_stock' });
    } else if (field === 'name') {
      if (!['contains', 'not_contains'].includes(op)) continue;
      const value = String(c.value ?? '').trim();
      if (!value) continue;
      conditions.push({ field: 'name', op: op as 'contains' | 'not_contains', value });
    } else {
      if (!['is', 'is_not'].includes(op)) continue;
      const value = String(c.value ?? '');
      if (!value) continue;
      conditions.push({ field: field as 'category' | 'tag' | 'brand' | 'attribute', op: op as 'is' | 'is_not', value });
    }
  }
  return sort ? { match, conditions, sort } : { match, conditions };
}

export const hasConditions = (rule: RuleConfig): boolean => rule.conditions.length > 0;
