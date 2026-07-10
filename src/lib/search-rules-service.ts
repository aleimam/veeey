import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { normalizeQuery } from '@/lib/search-normalize';

/**
 * Search rules (#186) — merchandising fixes for queries that return nothing.
 * A normalized query either REWRITEs to different terms (so it finds results)
 * or REDIRECTs the searcher to a page. `normalizeQuery` (pure, in search-normalize)
 * is shared by the save path and the match path so "vit d" also catches "Vit-D".
 */

export type SearchRuleKind = 'REWRITE' | 'REDIRECT';

export { normalizeQuery };

export async function matchSearchRule(q: string): Promise<{ kind: SearchRuleKind; rewriteTo: string | null; targetUrl: string | null } | null> {
  const query = normalizeQuery(q);
  if (!query) return null;
  try {
    const rule = await prisma.searchRule.findUnique({ where: { query }, select: { kind: true, rewriteTo: true, targetUrl: true } });
    return rule ? { kind: rule.kind as SearchRuleKind, rewriteTo: rule.rewriteTo, targetUrl: rule.targetUrl } : null;
  } catch {
    return null; // never let a merchandising rule break search
  }
}

export function listSearchRules() {
  return prisma.searchRule.findMany({ orderBy: { updatedAt: 'desc' } });
}

export async function saveSearchRule(input: { query: string; kind: SearchRuleKind; rewriteTo?: string; targetUrl?: string; note?: string }) {
  const user = await requirePermission('catalog.write');
  const query = normalizeQuery(input.query);
  if (!query) throw new Error('INVALID');
  const kind: SearchRuleKind = input.kind === 'REDIRECT' ? 'REDIRECT' : 'REWRITE';
  const rewriteTo = kind === 'REWRITE' ? (input.rewriteTo?.trim() || null) : null;
  const targetUrl = kind === 'REDIRECT' ? (input.targetUrl?.trim() || null) : null;
  if (kind === 'REWRITE' && !rewriteTo) throw new Error('INVALID');
  if (kind === 'REDIRECT' && (!targetUrl || !targetUrl.startsWith('/'))) throw new Error('INVALID');
  const rule = await prisma.searchRule.upsert({
    where: { query },
    create: { query, kind, rewriteTo, targetUrl, note: input.note?.trim() || null, createdById: user.id },
    update: { kind, rewriteTo, targetUrl, note: input.note?.trim() || null },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'search.rule.save', entityType: 'SearchRule', entityId: rule.id, data: { query, kind } });
  return rule;
}

export async function deleteSearchRule(id: string) {
  const user = await requirePermission('catalog.write');
  await prisma.searchRule.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'search.rule.delete', entityType: 'SearchRule', entityId: id });
}
