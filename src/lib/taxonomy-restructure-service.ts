import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { buildRestructurePlan, type ExistingCat, type RestructurePlan } from '@/lib/taxonomy-restructure';

/**
 * Executes the category restructure plan (V2 CAT-4). Owner decisions: dry-run
 * page + one-click Apply; merged/duplicate categories are ARCHIVED (not
 * deleted); a full snapshot (categories + moved product links) is stored in
 * the audit log so the operation is reversible; slug changes write Redirect
 * rows so old category URLs keep resolving.
 *
 * Hardening (2026-07-08 review): the snapshot is written BEFORE any change
 * (a crash mid-apply used to leave a half-renamed tree with no snapshot at
 * all), the whole apply runs in ONE transaction, and redirects point at the
 * slug actually written (freeSlug may suffix when an archived category still
 * holds the canonical slug).
 */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function loadRestructurePlan(): Promise<RestructurePlan & { existing: ExistingCat[] }> {
  await requirePermission('catalog.write');
  const cats = await prisma.category.findMany({
    include: { _count: { select: { products: true, children: true } } },
    orderBy: { nameEn: 'asc' },
  });
  const existing: ExistingCat[] = cats.map((c) => ({
    id: c.id, nameEn: c.nameEn, nameAr: c.nameAr, slug: c.slug,
    parentId: c.parentId, archived: !!c.archivedAt, products: c._count.products, children: c._count.children,
  }));
  return { ...buildRestructurePlan(existing), existing };
}

async function freeSlug(tx: Tx, desired: string, ownId: string | null): Promise<string> {
  // If another record holds the slug, suffix until free (merge sources get
  // renamed out of the way before this runs, so suffixes are rare).
  let candidate = desired;
  let n = 2;
  while (true) {
    const found = await tx.category.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!found || found.id === ownId) return candidate;
    candidate = `${desired}-${n++}`;
  }
}

async function moveProducts(tx: Tx, fromId: string, toId: string): Promise<number> {
  const src = await tx.category.findUnique({ where: { id: fromId }, select: { products: { select: { id: true } } } });
  const ids = src?.products.map((p) => p.id) ?? [];
  for (let i = 0; i < ids.length; i += 100) {
    await tx.category.update({ where: { id: toId }, data: { products: { connect: ids.slice(i, i + 100).map((id) => ({ id })) } } });
  }
  await tx.category.update({ where: { id: fromId }, data: { products: { set: [] } } });
  return ids.length;
}

export type ApplyResult = {
  created: number; renamed: number; reslugged: number; merged: number;
  movedProducts: number; adopted: number; redirects: number; unmatched: number;
};

const catUrl = (slug: string) => `/products?category=${slug}`;

export async function applyRestructure(): Promise<ApplyResult> {
  const user = await requirePermission('catalog.write');
  const plan = await loadRestructurePlan();

  // ---- snapshot FIRST (reversal data survives a mid-apply crash) ------------
  const mergeIds = plan.merge.map((m) => m.fromId);
  const mergeLinks = mergeIds.length
    ? await prisma.category.findMany({ where: { id: { in: mergeIds } }, select: { id: true, products: { select: { id: true } } } })
    : [];
  const snapshot = {
    categories: plan.existing,
    mergedProductLinks: Object.fromEntries(mergeLinks.map((c) => [c.id, c.products.map((p) => p.id)])),
  };
  await audit({
    actorType: 'USER', actorId: user.id, action: 'taxonomy.restructure.snapshot', entityType: 'Category',
    entityId: `${plan.existing.length} categories pre-apply`, data: { snapshot },
  });

  const oldSlugById = new Map(plan.existing.map((c) => [c.id, c.slug]));

  const result = await prisma.$transaction(async (tx): Promise<ApplyResult> => {
    const result: ApplyResult = { created: 0, renamed: 0, reslugged: 0, merged: 0, movedProducts: 0, adopted: 0, redirects: 0, unmatched: plan.unmatched.length };
    const keyToId = new Map<string, string>();
    for (const a of plan.assign) keyToId.set(a.nodeKey, a.id);
    // Redirect targets use the slug ACTUALLY written (freeSlug may suffix).
    const actualSlugOfKey = new Map<string, string>();
    const redirects: { from: string; to: string }[] = [];

    // 1) Free the slugs of merge sources so primaries/creates can take them.
    for (const m of plan.merge) {
      await tx.category.update({ where: { id: m.fromId }, data: { slug: await freeSlug(tx, `merged-${m.fromId.slice(-8)}`, m.fromId) } });
    }

    // 2) Primaries: canonical name (+ seed Arabic name when empty) + target slug.
    const nodeBy = new Map(plan.nodes.map((n) => [n.key, n]));
    for (const a of plan.assign) {
      const node = nodeBy.get(a.nodeKey)!;
      const cur = await tx.category.findUnique({ where: { id: a.id }, select: { nameAr: true } });
      const slug = a.reslug ? await freeSlug(tx, node.finalSlug, a.id) : a.oldSlug;
      await tx.category.update({
        where: { id: a.id },
        data: {
          nameEn: node.name,
          ...(node.nameAr && !cur?.nameAr?.trim() ? { nameAr: node.nameAr } : {}),
          slug: a.reslug ? slug : undefined,
          archivedAt: null,
        },
      });
      actualSlugOfKey.set(a.nodeKey, slug);
      if (a.reslug) redirects.push({ from: catUrl(a.oldSlug), to: catUrl(slug) });
      if (a.rename) result.renamed++;
      if (a.reslug) result.reslugged++;
    }

    // 3) Create missing nodes (depth order so parents exist first).
    for (const n of plan.nodes) {
      if (keyToId.has(n.key)) continue;
      const slug = await freeSlug(tx, n.finalSlug, null);
      const created = await tx.category.create({
        data: { nameEn: n.name, nameAr: n.nameAr ?? null, slug },
        select: { id: true },
      });
      keyToId.set(n.key, created.id);
      actualSlugOfKey.set(n.key, slug);
      result.created++;
    }

    // 4) Re-parent every node record to match the tree.
    for (const n of plan.nodes) {
      const id = keyToId.get(n.key)!;
      await tx.category.update({ where: { id }, data: { parentId: n.parentKey ? keyToId.get(n.parentKey)! : null } });
    }

    // 5) Merges: move products, keep Arabic label, archive the source.
    for (const m of plan.merge) {
      const targetId = keyToId.get(m.intoKey)!;
      result.movedProducts += await moveProducts(tx, m.fromId, targetId);
      if (m.keepAsNameAr) {
        const target = await tx.category.findUnique({ where: { id: targetId }, select: { nameAr: true } });
        if (!target?.nameAr?.trim()) await tx.category.update({ where: { id: targetId }, data: { nameAr: m.fromName } });
      }
      await tx.category.update({ where: { id: m.fromId }, data: { archivedAt: new Date(), parentId: null } });
      const oldSlug = oldSlugById.get(m.fromId);
      const target = actualSlugOfKey.get(m.intoKey);
      if (oldSlug && target) redirects.push({ from: catUrl(oldSlug), to: catUrl(target) });
      result.merged++;
    }

    // 6) Adopts: keep the category, re-parent + fix its slug.
    for (const ad of plan.adopt) {
      let slug: string | null = null;
      if (ad.fixSlug) slug = await freeSlug(tx, ad.fixSlug, ad.id);
      await tx.category.update({
        where: { id: ad.id },
        data: { parentId: keyToId.get(ad.underKey)!, ...(slug ? { slug } : {}) },
      });
      if (slug && slug !== ad.oldSlug) redirects.push({ from: catUrl(ad.oldSlug), to: catUrl(slug) });
      result.adopted++;
    }

    // 7) Redirects for every slug that changed (old category URLs keep working).
    for (const r of redirects) {
      if (r.from === r.to) continue;
      await tx.redirect.upsert({ where: { fromPath: r.from }, update: { toPath: r.to }, create: { fromPath: r.from, toPath: r.to } });
      result.redirects++;
    }

    return result;
  }, { timeout: 180_000, maxWait: 15_000 });

  await audit({
    actorType: 'USER', actorId: user.id, action: 'taxonomy.restructure.apply', entityType: 'Category',
    entityId: `${plan.assign.length} mapped / ${result.merged} merged / ${result.created} created`,
    data: { result: { ...result } },
  });
  return result;
}
