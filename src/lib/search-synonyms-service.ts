import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { normalizeQuery } from '@/lib/search-normalize';

/**
 * Search synonyms / aliases (search extras #2). One entry maps a normalized term
 * to a set of equivalent normalized terms; searchProducts (expandTerms) matches
 * both directions, so "vit c" ⇄ "vitamin c" ⇄ "ascorbic acid" all find the same
 * products. Everything is stored normalized (Arabic-folded, tashkeel-stripped) so
 * matching is diacritic- and spelling-insensitive.
 */

export type SynonymRow = { id: string; normalized: string; synonyms: string[]; updatedAt: Date };

export function listSynonyms(): Promise<SynonymRow[]> {
  return prisma.searchSynonym.findMany({ orderBy: { updatedAt: 'desc' }, select: { id: true, normalized: true, synonyms: true, updatedAt: true } });
}

/** Split a free-text field (commas or newlines) into distinct normalized terms. */
export function parseSynonyms(raw: string, exclude?: string): string[] {
  const set = new Set(
    raw
      .split(/[,\n]/)
      .map((s) => normalizeQuery(s))
      .filter((s) => s.length >= 2 && s !== exclude),
  );
  return [...set].slice(0, 25);
}

export async function saveSynonym(input: { term: string; synonyms: string }): Promise<void> {
  const user = await requirePermission('catalog.write');
  const normalized = normalizeQuery(input.term);
  if (normalized.length < 2) throw new Error('INVALID');
  const synonyms = parseSynonyms(input.synonyms, normalized);
  if (synonyms.length === 0) throw new Error('INVALID');
  const row = await prisma.searchSynonym.upsert({
    where: { normalized },
    create: { normalized, synonyms },
    update: { synonyms },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'search.synonym.save', entityType: 'SearchSynonym', entityId: row.id, data: { normalized, synonyms } });
}

export async function deleteSynonym(id: string): Promise<void> {
  const user = await requirePermission('catalog.write');
  await prisma.searchSynonym.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'search.synonym.delete', entityType: 'SearchSynonym', entityId: id });
}
