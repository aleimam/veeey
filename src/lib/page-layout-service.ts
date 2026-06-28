import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { uniqueSlug } from '@/lib/slug';
import { normalizeLayout, parseLayout, type Block } from '@/lib/home-layout';

/** Composable landing pages (PageLayout) — homepage-builder blocks on arbitrary
 *  URLs (/[locale]/l/[slug]). Blocks reuse lib/home-layout + the ChewyHome
 *  renderer; product data is resolved by resolveHomeData (home-layout-service). */

const asBlocks = (json: unknown) => normalizeLayout(json as Block[], { appendBuiltins: false });

export function listPageLayouts() {
  return prisma.pageLayout.findMany({ orderBy: { updatedAt: 'desc' } });
}

export async function getPageLayoutById(id: string) {
  const row = await prisma.pageLayout.findUnique({ where: { id } });
  return row ? { row, blocks: asBlocks(row.blocks) } : null;
}

export async function getPublishedPage(slug: string) {
  const row = await prisma.pageLayout.findFirst({ where: { slug, status: 'PUBLISHED' } });
  return row ? { row, blocks: asBlocks(row.blocks) } : null;
}

export type PageLayoutInput = { id?: string; slug?: string; titleEn: string; titleAr?: string | null; status: string; blocks: Block[] };

export async function savePageLayout(input: PageLayoutInput) {
  const user = await requirePermission('settings.manage');
  const blocks = parseLayout(input.blocks, { appendBuiltins: false });
  const titleEn = (input.titleEn || '').trim() || 'Untitled';
  const status = input.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  const data = {
    titleEn,
    titleAr: input.titleAr?.trim() || null,
    status,
    blocks: blocks as unknown as Prisma.InputJsonValue,
  };

  if (input.id) {
    const row = await prisma.pageLayout.update({ where: { id: input.id }, data });
    await audit({ actorType: 'USER', actorId: user.id, action: 'page-layout.update', entityType: 'PageLayout', entityId: row.id });
    return row;
  }
  const slug = await uniqueSlug(input.slug || titleEn, async (s) => !!(await prisma.pageLayout.findUnique({ where: { slug: s } })));
  const row = await prisma.pageLayout.create({ data: { ...data, slug } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'page-layout.create', entityType: 'PageLayout', entityId: row.id });
  return row;
}

export async function deletePageLayout(id: string) {
  const user = await requirePermission('settings.manage');
  await prisma.pageLayout.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'page-layout.delete', entityType: 'PageLayout', entityId: id });
}
