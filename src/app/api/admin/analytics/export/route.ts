import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-guards';
import { visitorTimeSeries, audienceBreakdown, engagement, searchInsights, productPerformance } from '@/lib/analytics-insights';
import { resolveAnalyticsRange, rangeTag } from '@/lib/analytics-range';

/** CSV export for the analytics dashboard (Analytics P3). RBAC-gated to
 *  finance.read. Range = the shared contract (V5 audit F11/F20):
 *  `?report=<name>&preset=mtd|7d|30d|90d|custom[&from&to]` (legacy `?days=`
 *  still resolves), so the download matches the on-screen filter exactly and
 *  the filename says what window it covers. Excel-friendly (UTF-8 BOM). */
const cell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (headers: string[], rows: (string | number)[][]): string =>
  '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

export async function GET(req: Request) {
  try {
    await requirePermission('finance.read');
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k) ?? undefined;
  const report = q('report') ?? 'traffic';
  // V5 audit F20: honor the page's full range (custom windows included) — the
  // old `[7,30,90]` clamp silently exported a different window than shown.
  const range = resolveAnalyticsRange({ preset: q('preset'), days: q('days'), from: q('from'), to: q('to') }, { defaultPreset: '30d' });
  const { days, endAt } = range;
  let tag = rangeTag(range);

  let csv = '';
  if (report === 'traffic') {
    const rows = await visitorTimeSeries(days, endAt);
    csv = toCsv(['date', 'visitors', 'pageviews'], rows.map((r) => [r.date, r.visitors, r.pageviews]));
  } else if (report === 'audience') {
    const a = await audienceBreakdown(days, endAt);
    const flat: (string | number)[][] = [];
    for (const [dim, buckets] of Object.entries(a)) for (const b of buckets) flat.push([dim, b.key, b.count, (b.share * 100).toFixed(1) + '%']);
    csv = toCsv(['dimension', 'value', 'sessions', 'share'], flat);
  } else if (report === 'pages') {
    const e = await engagement(days, endAt);
    csv = toCsv(['path', 'views', 'avg_dwell_seconds'], e.topPages.map((p) => [p.path, p.views, (p.avgDwellMs / 1000).toFixed(1)]));
  } else if (report === 'searches') {
    const s = await searchInsights(days, 15, endAt);
    csv = toCsv(['query', 'searches'], s.top.map((t) => [t.q, t.count]));
  } else if (report === 'zero-searches') {
    const s = await searchInsights(days, 15, endAt);
    csv = toCsv(['query', 'zero_result_searches'], s.zeroResults.map((t) => [t.q, t.count]));
  } else if (report === 'products') {
    const p = await productPerformance(days, 50, endAt); // full list, matching the page's "show all"
    csv = toCsv(['sku', 'name', 'views', 'units_sold', 'view_to_buy'], p.map((r) => [r.sku, r.name, r.views, r.units, (r.conversion * 100).toFixed(1) + '%']));
  } else if (report === 'custom') {
    const { resolveReportConfig, runReport, REPORT_DIMENSIONS, REPORT_METRICS } = await import('@/lib/analytics-report');
    const cfg = resolveReportConfig({
      dimension: q('dimension'), metric: q('metric'),
      days: q('days'), preset: q('preset'), from: q('from'), to: q('to'),
      fdim: q('fdim'), fval: q('fval'),
    });
    const rows = await runReport(cfg);
    const dimLabel = REPORT_DIMENSIONS.find((d) => d.key === cfg.dimension)!.labelEn;
    const metLabel = REPORT_METRICS.find((m) => m.key === cfg.metric)!.labelEn;
    csv = toCsv([dimLabel, metLabel], rows.map((r) => [r.key, r.value]));
    // Descriptive filename: metric-by-dimension + window + any active filter (F20).
    const filter = cfg.filterDim && cfg.filterVal ? `-${cfg.filterDim}-${cfg.filterVal.replace(/[^\w-]+/g, '').slice(0, 24)}` : '';
    tag = `${cfg.metric}-by-${cfg.dimension}-${rangeTag(cfg.range)}${filter}`;
  } else {
    return new NextResponse('Unknown report', { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="veeey-analytics-${report}-${tag}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
