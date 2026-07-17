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
  } else if (report === 'sales') {
    // V6 audit S13: one export per Sales panel, on the same range + bookings
    // basis the page is showing. `salesAnalytics` owns that contract, so the
    // CSV can't drift from the screen.
    const { salesAnalytics } = await import('@/lib/sales-analytics');
    // Sales defaults to month-to-date, not the dashboard's 30d — resolving with
    // the wrong default would export a different window than the page shows.
    const salesRange = resolveAnalyticsRange({ preset: q('preset'), days: q('days'), from: q('from'), to: q('to') }, { defaultPreset: 'mtd' });
    const a = await salesAnalytics(salesRange.preset, salesRange.from ?? undefined, salesRange.to ?? undefined);
    const panel = q('panel') ?? 'period';
    const metricRow = (label: string, m: { count: number; revenue: number; aov: number }) => [label, m.count, (m.aov / 100).toFixed(2), (m.revenue / 100).toFixed(2)];
    const METRIC_HEADERS = ['segment', 'orders', 'aov_egp', 'revenue_egp'];

    if (panel === 'period') {
      csv = toCsv(METRIC_HEADERS, [metricRow('current', a.current), metricRow('previous', a.previous)]);
    } else if (panel === 'customer-type') {
      csv = toCsv(METRIC_HEADERS, [metricRow('new', a.newSeg), metricRow('repeat', a.repeatSeg)]);
    } else if (panel === 'order-size') {
      csv = toCsv(METRIC_HEADERS, [metricRow('big', a.bigSeg), metricRow('normal', a.normalSeg)]);
    } else if (panel === 'order-value-hist') {
      csv = toCsv(['band_egp', 'orders'], a.orderValueHist.map((b) => [b.label, b.count]));
    } else if (panel === 'lifetime-hist') {
      csv = toCsv(['band_egp', 'customers'], a.lifetimeHist.map((b) => [b.label, b.count]));
    } else if (panel === 'top-products' || panel === 'top-brands') {
      const { topSellers } = await import('@/lib/sales-analytics');
      // 50, not the page's 10: an export is where you go to see the tail.
      const top = await topSellers(a.range, 50);
      const list = panel === 'top-products' ? top.products : top.brands;
      csv = toCsv(['name_en', 'name_ar', 'units', 'line_revenue_egp'], list.map((r) => [r.nameEn, r.nameAr ?? '', r.units, (r.revenue / 100).toFixed(2)]));
    } else if (panel === 'trend') {
      // `period_start` not `date`: a row is a whole day/week/month depending on
      // how long the window is, and calling that "date" would misread.
      csv = toCsv(['period_start', 'grain', 'orders', 'revenue_egp'], a.trend.map((p) => [p.date, a.trendGrain, p.orders, (p.revenue / 100).toFixed(2)]));
    } else {
      return new NextResponse('Unknown panel', { status: 400 });
    }
    tag = `${panel}-${rangeTag(salesRange)}`;
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
