import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-guards';
import { visitorTimeSeries, audienceBreakdown, engagement, searchInsights, productPerformance } from '@/lib/analytics-insights';

/** CSV export for the analytics dashboard (Analytics P3). RBAC-gated to
 *  finance.read; `?report=<name>&days=<7|30|90>`. Excel-friendly (UTF-8 BOM). */
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
  const report = url.searchParams.get('report') ?? 'traffic';
  const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;

  let csv = '';
  if (report === 'traffic') {
    const rows = await visitorTimeSeries(days);
    csv = toCsv(['date', 'visitors', 'pageviews'], rows.map((r) => [r.date, r.visitors, r.pageviews]));
  } else if (report === 'audience') {
    const a = await audienceBreakdown(days);
    const flat: (string | number)[][] = [];
    for (const [dim, buckets] of Object.entries(a)) for (const b of buckets) flat.push([dim, b.key, b.count, (b.share * 100).toFixed(1) + '%']);
    csv = toCsv(['dimension', 'value', 'sessions', 'share'], flat);
  } else if (report === 'pages') {
    const e = await engagement(days);
    csv = toCsv(['path', 'views', 'avg_dwell_seconds'], e.topPages.map((p) => [p.path, p.views, (p.avgDwellMs / 1000).toFixed(1)]));
  } else if (report === 'searches') {
    const s = await searchInsights(days);
    csv = toCsv(['query', 'searches'], s.top.map((t) => [t.q, t.count]));
  } else if (report === 'zero-searches') {
    const s = await searchInsights(days);
    csv = toCsv(['query', 'zero_result_searches'], s.zeroResults.map((t) => [t.q, t.count]));
  } else if (report === 'products') {
    const p = await productPerformance(days);
    csv = toCsv(['sku', 'name', 'views', 'units_sold', 'view_to_buy'], p.map((r) => [r.sku, r.name, r.views, r.units, (r.conversion * 100).toFixed(1) + '%']));
  } else if (report === 'custom') {
    const { resolveReportConfig, runReport, REPORT_DIMENSIONS, REPORT_METRICS } = await import('@/lib/analytics-report');
    const cfg = resolveReportConfig({
      dimension: url.searchParams.get('dimension') ?? undefined,
      metric: url.searchParams.get('metric') ?? undefined,
      days: url.searchParams.get('days') ?? undefined,
      fdim: url.searchParams.get('fdim') ?? undefined,
      fval: url.searchParams.get('fval') ?? undefined,
    });
    const rows = await runReport(cfg);
    const dimLabel = REPORT_DIMENSIONS.find((d) => d.key === cfg.dimension)!.labelEn;
    const metLabel = REPORT_METRICS.find((m) => m.key === cfg.metric)!.labelEn;
    csv = toCsv([dimLabel, metLabel], rows.map((r) => [r.key, r.value]));
  } else {
    return new NextResponse('Unknown report', { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="veeey-analytics-${report}-${days}d.csv"`,
      'cache-control': 'no-store',
    },
  });
}
