/**
 * Rule-based personalization helpers (FR-PERS-01/03). Pure — drive recommendation
 * ordering from views/purchases without ML (ML/collaborative filtering = P2).
 */

/** Keep first occurrence of each key, preserving order. */
export function dedupeKeepOrder<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * Re-rank items, boosting those whose categories overlap the customer's affinity
 * set (more overlaps rank higher). Stable: ties keep original order. Used for
 * personalized search ranking (FR-PERS-03).
 */
export function rankByAffinity<T extends { categoryIds: string[] }>(items: T[], affinity: Set<string>): T[] {
  return items
    .map((item, i) => ({ item, i, score: item.categoryIds.reduce((s, c) => s + (affinity.has(c) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);
}

/** Count occurrences and return the most frequent ids first (ties: first seen). */
export function topByFrequency(ids: string[], limit: number): string[] {
  const counts = new Map<string, { n: number; first: number }>();
  ids.forEach((id, i) => {
    const c = counts.get(id);
    if (c) c.n += 1;
    else counts.set(id, { n: 1, first: i });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)
    .slice(0, limit)
    .map(([id]) => id);
}
