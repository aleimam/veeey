/**
 * Pure sales-analytics helpers (period math + value bucketing). No prisma /
 * settings imports so it stays vitest-friendly; the service (sales-analytics.ts)
 * builds on these.
 */
export type PeriodPreset = 'mtd' | '7d' | '30d' | '90d' | 'custom';
export type Range = { start: Date; end: Date; prevStart: Date; prevEnd: Date };
export type Metrics = { count: number; revenue: number; aov: number }; // piastres
export type Bucket = { label: string; count: number };

/** Resolve the selected period + the comparable previous period. Pure. */
export function periodRange(preset: PeriodPreset, fromIso: string | undefined, toIso: string | undefined, now: Date): Range {
  const end = new Date(now);
  if (preset === 'custom' && fromIso && toIso) {
    const start = new Date(`${fromIso}T00:00:00`);
    const e = new Date(`${toIso}T23:59:59`);
    const lenMs = e.getTime() - start.getTime();
    return { start, end: e, prevStart: new Date(start.getTime() - lenMs - 1), prevEnd: new Date(start.getTime() - 1) };
  }
  if (preset === '7d' || preset === '30d' || preset === '90d') {
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    const start = new Date(end); start.setDate(start.getDate() - days);
    const prevEnd = new Date(start);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - days);
    return { start, end, prevStart, prevEnd };
  }
  // month-to-date (default) vs the same elapsed span of the previous month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const elapsed = end.getTime() - start.getTime();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { start, end, prevStart, prevEnd: new Date(prevStart.getTime() + elapsed) };
}

export const VALUE_EDGES = [0, 50000, 100000, 200000, 300000, 500000]; // piastres
export const LIFETIME_EDGES = [0, 50000, 100000, 300000, 500000, 1000000];

export const bucketLabels = (edges: number[]): string[] =>
  edges.map((e, i) => (i === edges.length - 1 ? `${e / 100}+` : `${e / 100}–${edges[i + 1] / 100}`));

/** Bucket order totals (piastres) into value bands. Pure. */
export function bucketByValue(totals: number[], edges = VALUE_EDGES): Bucket[] {
  const labels = bucketLabels(edges);
  const counts = new Array(edges.length).fill(0);
  for (const t of totals) {
    let idx = 0;
    for (let i = 0; i < edges.length; i++) if (t >= edges[i]) idx = i;
    counts[idx]++;
  }
  return labels.map((label, i) => ({ label, count: counts[i] }));
}
