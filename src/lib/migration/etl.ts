import { mapOrderStatus, mapPaymentMethod, clampDate } from './transforms';

/**
 * Migration dry-run (P15). Validates a parsed source export and produces a
 * per-entity report (counts + warnings) WITHOUT writing to the DB. The `--apply`
 * path (real writes) is gated for cutover against the fresh export only.
 * Pure given `now` — no DB, no side effects.
 */
export type SourceExport = {
  products?: { sku?: string; wpId?: number; name?: string }[];
  customers?: { email?: string; name?: string }[];
  orders?: { number?: string; status?: string; paymentMethod?: string; totalEgp?: number }[];
  reviews?: { sku?: string; rating?: number | null; date?: string }[];
};

export type EntityReport = { entity: string; total: number; ok: number; warnings: string[] };
export type MigrationReport = { reports: EntityReport[]; totalRows: number; totalOk: number; totalWarnings: number };

const MIN_DATE = new Date('2014-01-01T00:00:00Z');

export function dryRun(src: SourceExport, opts: { now: Date }): MigrationReport {
  const reports: EntityReport[] = [];

  // Products — need SKU or wpId to join; name required.
  {
    const rows = src.products ?? [];
    const warnings: string[] = [];
    let ok = 0;
    for (const p of rows) {
      if (!p.sku && p.wpId == null) warnings.push(`product "${p.name ?? '?'}" has no SKU or wpId (cannot join)`);
      else if (!p.name) warnings.push(`product ${p.sku ?? p.wpId} missing name`);
      else ok += 1;
    }
    reports.push({ entity: 'products', total: rows.length, ok, warnings });
  }

  // Customers — dedupe by email.
  {
    const rows = src.customers ?? [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let ok = 0;
    for (const c of rows) {
      const e = c.email?.trim().toLowerCase();
      if (!e) { warnings.push(`customer "${c.name ?? '?'}" missing email`); continue; }
      if (seen.has(e)) { warnings.push(`duplicate customer email ${e} → merge`); continue; }
      seen.add(e);
      ok += 1;
    }
    reports.push({ entity: 'customers', total: rows.length, ok, warnings });
  }

  // Orders — status + payment must map.
  {
    const rows = src.orders ?? [];
    const warnings: string[] = [];
    let ok = 0;
    for (const o of rows) {
      const s = mapOrderStatus(o.status ?? '');
      const p = mapPaymentMethod(o.paymentMethod ?? '');
      if (!s.matched) warnings.push(`order ${o.number ?? '?'}: unmapped status "${o.status}"`);
      if (!p.matched) warnings.push(`order ${o.number ?? '?'}: ${p.warning ?? `unmapped payment "${o.paymentMethod}"`}`);
      if (s.matched && p.matched) ok += 1;
    }
    reports.push({ entity: 'orders', total: rows.length, ok, warnings });
  }

  // Reviews — clamp bogus dates, flag score-less.
  {
    const rows = src.reviews ?? [];
    const warnings: string[] = [];
    let ok = 0;
    for (const r of rows) {
      if (r.rating == null) warnings.push('review missing score → import unrated or skip');
      const d = r.date ? new Date(r.date) : null;
      if (d && !Number.isNaN(d.getTime())) {
        const c = clampDate(d, MIN_DATE, opts.now);
        if (c.clamped) warnings.push(`review date ${r.date} out of range → clamped`);
      } else if (r.date) {
        warnings.push(`review date "${r.date}" unparseable`);
      }
      ok += 1;
    }
    reports.push({ entity: 'reviews', total: rows.length, ok, warnings });
  }

  const totalRows = reports.reduce((s, r) => s + r.total, 0);
  const totalOk = reports.reduce((s, r) => s + r.ok, 0);
  const totalWarnings = reports.reduce((s, r) => s + r.warnings.length, 0);
  return { reports, totalRows, totalOk, totalWarnings };
}
