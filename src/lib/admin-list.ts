/**
 * Shared helpers for admin list pages: sort + pagination resolved from the URL
 * (so they're shareable and the CSV export can reuse the same params). Pure — no
 * DB/React — so it's unit-testable and usable from both server pages and the
 * export adapters.
 */
export type SortDir = 'asc' | 'desc';
export type SP = Record<string, string | string[] | undefined>;

export const one = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v) || undefined;

export type ListParams = { sort: string; dir: SortDir; page: number; perPage: number; skip: number; take: number };

/**
 * Resolve sort/dir/page/perPage from search params. `sort` is validated against
 * an allow-list (so a column name from the URL can't reach raw Prisma); page is
 * clamped to >= 1 and perPage to [10, 200].
 */
export function parseListParams(
  sp: SP,
  opts: { sortable: readonly string[]; defaultSort: string; defaultDir?: SortDir; perPage?: number },
): ListParams {
  const sortRaw = one(sp.sort);
  const sort = sortRaw && opts.sortable.includes(sortRaw) ? sortRaw : opts.defaultSort;
  const dirRaw = one(sp.dir);
  const dir: SortDir = dirRaw === 'asc' ? 'asc' : dirRaw === 'desc' ? 'desc' : (opts.defaultDir ?? 'desc');
  const perPage = Math.min(200, Math.max(10, Number(one(sp.per)) || opts.perPage || 50));
  const page = Math.max(1, Math.floor(Number(one(sp.page)) || 1));
  return { sort, dir, page, perPage, skip: (page - 1) * perPage, take: perPage };
}

/**
 * Build a `?a=b&c=d` query string from existing params plus overrides. Overrides
 * set to undefined/'' are removed. Returns '' when empty (no leading '?').
 */
export function listQs(sp: SP, overrides: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val != null && val !== '') params.set(k, val);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null || v === '') params.delete(k);
    else params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function totalPages(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, perPage)));
}

/** 1-based inclusive row range shown on the current page, e.g. "51–100 of 2739". */
export function pageRange(page: number, perPage: number, total: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * perPage + 1;
  return { from, to: Math.min(total, page * perPage) };
}
