import { wooFetch, type WooEntity } from '@/lib/woocommerce';
import { analyzeProduct, analyzeCustomer, analyzeOrder, type Analysis, type FlagCode } from '@/lib/migration/wc-transform';

/**
 * Migration dry-run: scans WooCommerce (bounded, read-only) and aggregates what
 * an import WOULD do — flag counts + samples, distinct-value breakdowns, and
 * validation errors. Writes nothing. Bounded by maxPages so an on-demand admin
 * run stays responsive; a full scan is a later background job.
 */

export type DryRunEntity = 'products' | 'customers' | 'orders';

export type DryRunReport = {
  entity: DryRunEntity;
  total: number;
  scanned: number;
  valid: number;
  errors: number;
  truncated: boolean;
  flags: { code: FlagCode; count: number; samples: string[] }[];
  distinct: { label: [string, string]; values: { value: string; count: number }[] }[];
  sampleErrors: { key: string; detail: string }[];
  error?: string;
};

const ENDPOINT: Record<DryRunEntity, WooEntity> = { products: 'products', customers: 'customers', orders: 'orders' };
const ANALYZE: Record<DryRunEntity, (r: Record<string, unknown>) => Analysis> = {
  products: analyzeProduct,
  customers: analyzeCustomer,
  orders: analyzeOrder,
};

const sObj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const sStr = (v: unknown): string => (v == null ? '' : typeof v === 'object' ? '' : String(v));

export async function dryRun(entity: DryRunEntity, maxPages = 10, perPage = 100): Promise<DryRunReport> {
  const endpoint = ENDPOINT[entity];
  const analyze = ANALYZE[entity];
  const flagMap = new Map<FlagCode, { count: number; samples: string[] }>();
  const distinctMaps: Record<string, Map<string, number>> = {};
  const bump = (group: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    const m = (distinctMaps[group] ??= new Map());
    m.set(v, (m.get(v) ?? 0) + 1);
  };

  let total = 0;
  let scanned = 0;
  let valid = 0;
  let errors = 0;
  const sampleErrors: { key: string; detail: string }[] = [];

  try {
    let page = 1;
    let totalPages = 1;
    while (page <= Math.min(maxPages, totalPages)) {
      const res = await wooFetch(endpoint, { page, per_page: perPage });
      total = res.total;
      totalPages = res.totalPages;
      const items = res.data as Record<string, unknown>[];
      if (items.length === 0) break;
      for (const it of items) {
        scanned++;
        const a = analyze(it);
        if (a.ok) valid++;
        else {
          errors++;
          if (sampleErrors.length < 10) sampleErrors.push({ key: a.key, detail: a.errorDetail ?? 'invalid' });
        }
        for (const f of a.flags) {
          const e = flagMap.get(f) ?? { count: 0, samples: [] };
          e.count++;
          if (e.samples.length < 5) e.samples.push(a.key);
          flagMap.set(f, e);
        }
        if (entity === 'products') for (const c of Array.isArray(it.categories) ? it.categories : []) bump('categories', sStr(sObj(c).name));
        if (entity === 'customers') {
          const b = sObj(it.billing);
          bump('cities', sStr(b.city));
          bump('governorates', sStr(b.state));
        }
        if (entity === 'orders') {
          bump('statuses', sStr(it.status));
          bump('currencies', sStr(it.currency));
        }
      }
      page++;
    }
  } catch (e) {
    return { entity, total, scanned, valid, errors, truncated: scanned < total, flags: [], distinct: [], sampleErrors, error: e instanceof Error ? e.message : 'ERROR' };
  }

  const flags = [...flagMap.entries()].map(([code, v]) => ({ code, count: v.count, samples: v.samples })).sort((a, b) => b.count - a.count);
  const topN = (m: Map<string, number> | undefined, n = 25) =>
    m ? [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count).slice(0, n) : [];

  const distinct: DryRunReport['distinct'] = [];
  if (entity === 'products') distinct.push({ label: ['Categories', 'الفئات'], values: topN(distinctMaps.categories) });
  if (entity === 'customers') {
    distinct.push({ label: ['Cities (free text → courier zone)', 'المدن (نص حر ← منطقة الشحن)'], values: topN(distinctMaps.cities) });
    distinct.push({ label: ['Governorates', 'المحافظات'], values: topN(distinctMaps.governorates) });
  }
  if (entity === 'orders') {
    distinct.push({ label: ['Order statuses (→ Veeey status map)', 'حالات الطلب (← خريطة حالات Veeey)'], values: topN(distinctMaps.statuses) });
    distinct.push({ label: ['Currencies', 'العملات'], values: topN(distinctMaps.currencies) });
  }

  return { entity, total, scanned, valid, errors, truncated: scanned < total, flags, distinct, sampleErrors };
}
