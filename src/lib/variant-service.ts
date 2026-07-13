import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { normalizeAxes, parseVariantValues, buildAxisRows, MAX_AXES, type AxisRow, type VariantSibling, type VariantAxis } from '@/lib/variant-groups';

/**
 * Variant families (audit P1 §5.4). Sibling Products linked by VariantGroup;
 * this service loads the PDP selector + shared-review aggregates and carries the
 * admin CRUD. Pure axis/resolution logic lives in variant-groups.ts (tested).
 */

// ---- PDP reads ---------------------------------------------------------------

export type VariantSelector = { rows: AxisRow[]; memberIds: string[] };

/** Selector rows for a product's group (null when no group / <2 usable members).
 *  Siblings must be PUBLISHED to be linkable; the current product is always kept. */
export async function variantSelectorFor(productId: string, groupId: string): Promise<VariantSelector | null> {
  const group = await prisma.variantGroup.findUnique({
    where: { id: groupId },
    select: {
      axesJson: true,
      products: {
        where: { OR: [{ status: 'PUBLISHED' }, { id: productId }] },
        select: {
          id: true, slugEn: true, slugAr: true, variantJson: true, variantSort: true,
          lots: { where: { status: 'LIVE', qtyOnHand: { gt: 0 } }, take: 1, select: { id: true } },
        },
      },
    },
  });
  if (!group) return null;
  const axes = normalizeAxes(group.axesJson);
  if (axes.length === 0 || group.products.length < 2) return null;
  const siblings: VariantSibling[] = group.products.map((p) => ({
    id: p.id,
    slugEn: p.slugEn,
    slugAr: p.slugAr,
    sort: p.variantSort,
    inStock: p.lots.length > 0,
    values: parseVariantValues(p.variantJson, axes),
  }));
  const rows = buildAxisRows(axes, siblings, productId);
  if (rows.length === 0) return null;
  return { rows, memberIds: siblings.map((s) => s.id) };
}

export type SharedReviews = {
  ratingAvg: number;
  ratingCount: number;
  reviews: Awaited<ReturnType<typeof loadGroupReviews>>;
};

function loadGroupReviews(memberIds: string[], take: number) {
  return prisma.review.findMany({
    where: { productId: { in: memberIds }, status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    take,
    include: { media: true },
  });
}

/** Reviews + rating aggregated across the whole variant family (owner choice:
 *  a new pack size inherits its siblings' social proof). */
export async function sharedReviewsFor(memberIds: string[], take = 20): Promise<SharedReviews> {
  const [agg, reviews] = await Promise.all([
    prisma.review.aggregate({ where: { productId: { in: memberIds }, status: 'APPROVED' }, _avg: { rating: true }, _count: { _all: true } }),
    loadGroupReviews(memberIds, take),
  ]);
  return {
    ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
    ratingCount: agg._count._all,
    reviews,
  };
}

// ---- Admin CRUD ----------------------------------------------------------------

export type GroupListRow = { id: string; name: string; axes: VariantAxis[]; memberCount: number; updatedAt: Date };

export async function listVariantGroups(): Promise<GroupListRow[]> {
  const rows = await prisma.variantGroup.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, axesJson: true, updatedAt: true, _count: { select: { products: true } } },
  });
  return rows.map((g) => ({ id: g.id, name: g.name, axes: normalizeAxes(g.axesJson), memberCount: g._count.products, updatedAt: g.updatedAt }));
}

export type GroupDetail = {
  id: string;
  name: string;
  axes: VariantAxis[];
  members: { productId: string; nameEn: string; sku: string; thumb: string | null; sort: number; values: (null | { en: string; ar: string })[] }[];
};

export async function getVariantGroup(id: string): Promise<GroupDetail | null> {
  const g = await prisma.variantGroup.findUnique({
    where: { id },
    select: {
      id: true, name: true, axesJson: true,
      products: {
        orderBy: { variantSort: 'asc' },
        select: {
          id: true, nameEn: true, sku: true, variantJson: true, variantSort: true,
          images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
        },
      },
    },
  });
  if (!g) return null;
  const axes = normalizeAxes(g.axesJson);
  return {
    id: g.id,
    name: g.name,
    axes,
    members: g.products.map((p) => {
      const values = parseVariantValues(p.variantJson, axes);
      return {
        productId: p.id, nameEn: p.nameEn, sku: p.sku, thumb: p.images[0]?.url ?? null, sort: p.variantSort,
        values: axes.map((a) => values[a.key] ?? null),
      };
    }),
  };
}

export type SaveGroupInput = {
  id?: string;
  name: string;
  axes: { nameEn: string; nameAr: string }[];
  /** values aligned to the axes array by index; null = no value for that axis. */
  members: { productId: string; sort: number; values: ({ en: string; ar: string } | null)[] }[];
};

/** Create/update a group: axes + full member set (removed members are unlinked). */
export async function saveVariantGroup(input: SaveGroupInput): Promise<{ id: string }> {
  const user = await requirePermission('catalog.write');
  const name = input.name.trim();
  const axes = normalizeAxes(input.axes);
  if (!name || axes.length === 0 || axes.length > MAX_AXES) throw new Error('INVALID');
  const members = input.members.filter((m) => m.productId).slice(0, 40);
  if (members.length < 2) throw new Error('INVALID'); // a family needs ≥2 siblings

  const id = await prisma.$transaction(async (tx) => {
    const group = input.id
      ? await tx.variantGroup.update({ where: { id: input.id }, data: { name, axesJson: axes } })
      : await tx.variantGroup.create({ data: { name, axesJson: axes } });
    // Unlink products no longer in the member list.
    await tx.product.updateMany({
      where: { variantGroupId: group.id, id: { notIn: members.map((m) => m.productId) } },
      data: { variantGroupId: null, variantJson: undefined, variantSort: 0 },
    });
    for (const [i, m] of members.entries()) {
      const variantJson: Record<string, { en: string; ar: string }> = {};
      for (const [ai, axis] of axes.entries()) {
        const v = m.values[ai];
        if (v && v.en.trim()) variantJson[axis.key] = { en: v.en.trim(), ar: (v.ar ?? '').trim() || v.en.trim() };
      }
      await tx.product.update({
        where: { id: m.productId },
        data: { variantGroupId: group.id, variantJson, variantSort: Number.isFinite(m.sort) ? m.sort : i },
      });
    }
    return group.id;
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'variant.group.save', entityType: 'VariantGroup', entityId: id, data: { name, axes: axes.map((a) => a.nameEn), members: members.length } });
  return { id };
}

/** Delete a group and unlink its members (products themselves are untouched). */
export async function deleteVariantGroup(id: string): Promise<void> {
  const user = await requirePermission('catalog.write');
  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({ where: { variantGroupId: id }, data: { variantGroupId: null, variantJson: undefined, variantSort: 0 } });
    await tx.variantGroup.delete({ where: { id } });
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'variant.group.delete', entityType: 'VariantGroup', entityId: id });
}
