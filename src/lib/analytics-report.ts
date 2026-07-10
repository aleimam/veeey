import { prisma } from '@/lib/prisma';

/**
 * Custom report builder (Analytics P6). Pivot any metric by any dimension over
 * the visitor clickstream. Dimensions/metrics map to ALLOW-LISTED SQL fragments;
 * only validated keys + parameterized values ever reach the query, so the raw
 * $queryRawUnsafe below can never be injected. Everything is bot-filtered.
 */
export const REPORT_DIMENSIONS = [
  { key: 'device', labelEn: 'Device', labelAr: 'الجهاز', sql: 's."deviceType"' },
  { key: 'country', labelEn: 'Country', labelAr: 'الدولة', sql: 's."country"' },
  { key: 'browser', labelEn: 'Browser', labelAr: 'المتصفح', sql: 's."browser"' },
  { key: 'os', labelEn: 'OS', labelAr: 'نظام التشغيل', sql: 's."os"' },
  { key: 'language', labelEn: 'Language', labelAr: 'اللغة', sql: 's."language"' },
  { key: 'referrer', labelEn: 'Referrer', labelAr: 'المُحيل', sql: 's."referrer"' },
  { key: 'day', labelEn: 'Day', labelAr: 'اليوم', sql: `to_char(date_trunc('day', e."createdAt"), 'YYYY-MM-DD')` },
  { key: 'event', labelEn: 'Event type', labelAr: 'نوع الحدث', sql: 'e."type"' },
  { key: 'page', labelEn: 'Page', labelAr: 'الصفحة', sql: 'e."path"' },
] as const;

export const REPORT_METRICS = [
  { key: 'sessions', labelEn: 'Visitors', labelAr: 'الزوّار', sql: 'count(distinct e."sessionId")::int' },
  { key: 'pageviews', labelEn: 'Pageviews', labelAr: 'المشاهدات', sql: `count(*) filter (where e.type = 'page_view')::int` },
  { key: 'events', labelEn: 'Events', labelAr: 'الأحداث', sql: 'count(*)::int' },
  { key: 'avg_dwell', labelEn: 'Avg. dwell (s)', labelAr: 'متوسط البقاء (ث)', sql: `coalesce(round((avg(e."durationMs") filter (where e.type = 'page_leave')) / 1000.0, 1), 0)::float8` },
] as const;

export type DimKey = (typeof REPORT_DIMENSIONS)[number]['key'];
export type MetricKey = (typeof REPORT_METRICS)[number]['key'];
export type ReportConfig = { dimension: DimKey; metric: MetricKey; days: number; filterDim: DimKey | null; filterVal: string };
export type ReportRow = { key: string; value: number };

const DIM_KEYS = new Set<string>(REPORT_DIMENSIONS.map((d) => d.key));
const METRIC_KEYS = new Set<string>(REPORT_METRICS.map((m) => m.key));
const DAYS = [7, 30, 90];

/** Validate raw query params into a safe config (allow-listed keys only). Pure. */
export function resolveReportConfig(raw: { dimension?: string; metric?: string; days?: string; fdim?: string; fval?: string }): ReportConfig {
  const dimension = (DIM_KEYS.has(raw.dimension ?? '') ? raw.dimension : 'device') as DimKey;
  const metric = (METRIC_KEYS.has(raw.metric ?? '') ? raw.metric : 'sessions') as MetricKey;
  const days = DAYS.includes(Number(raw.days)) ? Number(raw.days) : 30;
  const filterDim = raw.fdim && DIM_KEYS.has(raw.fdim) ? (raw.fdim as DimKey) : null;
  const filterVal = filterDim ? String(raw.fval ?? '').trim().slice(0, 200) : '';
  return { dimension, metric, days, filterDim, filterVal };
}

const dimSql = (k: DimKey) => REPORT_DIMENSIONS.find((d) => d.key === k)!.sql;
const metricSql = (k: MetricKey) => REPORT_METRICS.find((m) => m.key === k)!.sql;

/** Run a resolved report → ranked [{key, value}] rows (top 100). */
export async function runReport(cfg: ReportConfig): Promise<ReportRow[]> {
  const start = new Date(Date.now() - cfg.days * 86_400_000);
  const params: unknown[] = [start];
  let filterSql = '';
  if (cfg.filterDim && cfg.filterVal) {
    params.push(cfg.filterVal);
    filterSql = ` AND ${dimSql(cfg.filterDim)} = $${params.length}`;
  }
  const sql = `
    SELECT COALESCE(${dimSql(cfg.dimension)}, 'Unknown') AS k, ${metricSql(cfg.metric)} AS v
    FROM "AnalyticsEvent" e JOIN "AnalyticsSession" s ON s."sessionId" = e."sessionId"
    WHERE e."createdAt" >= $1 AND s."isBot" = false${filterSql}
    GROUP BY 1 ORDER BY v DESC NULLS LAST LIMIT 100`;
  const rows = await prisma.$queryRawUnsafe<Array<{ k: string; v: number }>>(sql, ...params);
  return rows.map((r) => ({ key: String(r.k), value: Number(r.v) }));
}
