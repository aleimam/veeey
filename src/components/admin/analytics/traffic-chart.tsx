'use client';

import { useState } from 'react';

/**
 * Dual-series traffic chart (V5 audit F2/F3/F4). Interactive rebuild of the old
 * static SVG, following the Sales BarChart pattern (client component, hover +
 * focus tooltips, direct `var(--…)` theme tokens — the old chart used
 * `hsl(var(--primary))` against HEX tokens, i.e. invalid CSS, which is why the
 * visitors line never rendered and dark mode showed nothing).
 * - tooltips: hover/focus any day → date + both series values
 * - y-axis + gridlines, theme-aware colors (--chart-1 / --chart-2)
 * - visitors auto-normalize to their own scale when pageviews dwarf them (F3)
 * - line / area / bar toggle
 * - keyboard-focusable day columns + sr-only data table
 * Chart stays LTR even in RTL admin — time reads left→right universally.
 */
export type TrafficPoint = { date: string; visitors: number; pageviews: number };
export type TrafficChartLabels = {
  visitors: string;
  pageviews: string;
  line: string;
  area: string;
  bar: string;
  scaled: string; // e.g. "(own scale)" — shown when visitors are normalized
};

type Kind = 'area' | 'line' | 'bar';

const PV_COLOR = 'var(--chart-1, var(--primary))';
const VI_COLOR = 'var(--chart-2, #8bc34a)';

export function TrafficChart({ series, labels }: { series: TrafficPoint[]; labels: TrafficChartLabels }) {
  const [kind, setKind] = useState<Kind>('area');
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 224;
  const padL = 46;
  const padR = 8;
  const padTop = 10;
  const padBottom = 22;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBottom;

  const n = series.length;
  const maxPv = Math.max(1, ...series.map((s) => s.pageviews));
  const maxVi = Math.max(1, ...series.map((s) => s.visitors));
  // F3: when pageviews dwarf visitors, give visitors their own scale so the
  // series stays readable; tooltips always show the true values.
  const scaledVisitors = maxPv / maxVi > 8;

  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yPv = (v: number) => padTop + (1 - v / maxPv) * plotH;
  const yVi = (v: number) => padTop + (1 - v / (scaledVisitors ? maxVi : maxPv)) * plotH;

  const linePath = (key: 'visitors' | 'pageviews') => {
    const yf = key === 'visitors' ? yVi : yPv;
    return series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yf(s[key]).toFixed(1)}`).join(' ');
  };
  const areaPath = n > 0 ? `${linePath('pageviews')} L${x(n - 1).toFixed(1)},${(H - padBottom).toFixed(1)} L${x(0).toFixed(1)},${(H - padBottom).toFixed(1)} Z` : '';

  const gridFractions = [0.25, 0.5, 0.75, 1];
  const fmt = (v: number) => v.toLocaleString('en-US');
  const dateTicks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 1 ? [0] : [];
  const barW = Math.max(2, Math.min(18, (plotW / Math.max(1, n)) * 0.7));

  const kinds: Array<{ k: Kind; label: string }> = [
    { k: 'area', label: labels.area },
    { k: 'line', label: labels.line },
    { k: 'bar', label: labels.bar },
  ];

  return (
    <div dir="ltr" className="w-full min-w-0 select-none">
      {/* chart-type toggle (F2) */}
      <div className="mb-2 flex justify-end gap-1" role="group">
        {kinds.map(({ k, label }) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${labels.pageviews} + ${labels.visitors}`} style={{ height: 224 }}>
          {/* gridlines + y-axis values (F2), theme-aware (F4) */}
          {gridFractions.map((f) => (
            <g key={f}>
              <line x1={padL} y1={padTop + (1 - f) * plotH} x2={W - padR} y2={padTop + (1 - f) * plotH} style={{ stroke: 'var(--border)' }} strokeWidth={1} strokeDasharray={f === 1 ? undefined : '3 3'} />
              <text x={padL - 6} y={padTop + (1 - f) * plotH + 3} textAnchor="end" style={{ fill: 'var(--muted-foreground)', fontSize: 10 }}>
                {fmt(Math.round(maxPv * f))}
              </text>
            </g>
          ))}
          <line x1={padL} y1={H - padBottom} x2={W - padR} y2={H - padBottom} style={{ stroke: 'var(--border)' }} strokeWidth={1} />

          {/* series */}
          {kind === 'bar' ? (
            <>
              {series.map((s, i) => (
                <rect key={i} x={x(i) - barW / 2} y={yPv(s.pageviews)} width={barW} height={Math.max(0, H - padBottom - yPv(s.pageviews))} rx={1.5} style={{ fill: PV_COLOR, opacity: hover === i ? 1 : 0.75 }} />
              ))}
              <path d={linePath('visitors')} fill="none" style={{ stroke: VI_COLOR }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : (
            <>
              {kind === 'area' && <path d={areaPath} style={{ fill: PV_COLOR, opacity: 0.12 }} />}
              <path d={linePath('pageviews')} fill="none" style={{ stroke: PV_COLOR }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <path d={linePath('visitors')} fill="none" style={{ stroke: VI_COLOR }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}

          {/* hover/focus guide + markers */}
          {hover !== null && series[hover] && (
            <g>
              <line x1={x(hover)} y1={padTop} x2={x(hover)} y2={H - padBottom} style={{ stroke: 'var(--muted-foreground)', opacity: 0.5 }} strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={yPv(series[hover].pageviews)} r={3.5} style={{ fill: PV_COLOR, stroke: 'var(--card)' }} strokeWidth={1.5} />
              <circle cx={x(hover)} cy={yVi(series[hover].visitors)} r={3.5} style={{ fill: VI_COLOR, stroke: 'var(--card)' }} strokeWidth={1.5} />
            </g>
          )}

          {/* x-axis date ticks */}
          {dateTicks.map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} style={{ fill: 'var(--muted-foreground)', fontSize: 10 }}>
              {series[i]?.date.slice(5)}
            </text>
          ))}
        </svg>

        {/* invisible hit zones: hover + keyboard focus per day (F2) */}
        <div className="absolute inset-x-0 top-0 flex" style={{ height: `${((H - padBottom) / H) * 100}%`, paddingInlineStart: `${(padL / W) * 100}%`, paddingInlineEnd: `${(padR / W) * 100}%` }}>
          {series.map((s, i) => (
            <button
              key={s.date}
              type="button"
              aria-label={`${s.date}: ${labels.pageviews} ${fmt(s.pageviews)}, ${labels.visitors} ${fmt(s.visitors)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="relative h-full min-w-0 flex-1"
            >
              {hover === i && (
                <span className={`absolute top-0 z-10 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow ${i > n * 0.66 ? 'right-0' : i < n * 0.33 ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}>
                  {s.date} · {labels.pageviews}: {fmt(s.pageviews)} · {labels.visitors}: {fmt(s.visitors)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* legend (F2/F3) */}
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: PV_COLOR }} />{labels.pageviews}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: VI_COLOR }} />{labels.visitors}{scaledVisitors ? ` ${labels.scaled}` : ''}</span>
      </div>

      {/* accessible data table (analytics a11y DoD) */}
      <table className="sr-only">
        <caption>{`${labels.pageviews} / ${labels.visitors}`}</caption>
        <thead>
          <tr><th scope="col">Date</th><th scope="col">{labels.pageviews}</th><th scope="col">{labels.visitors}</th></tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.date}><td>{s.date}</td><td>{s.pageviews}</td><td>{s.visitors}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
