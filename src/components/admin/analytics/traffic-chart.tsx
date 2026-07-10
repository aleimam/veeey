/**
 * Dual-line traffic chart (Analytics P3) — pure SVG, no client JS or chart lib.
 * Pageviews (filled area + line) + visitors (line) over the selected window.
 * Chart stays LTR even in RTL admin — time reads left→right universally.
 */
export function TrafficChart({
  series,
  labels,
}: {
  series: Array<{ date: string; visitors: number; pageviews: number }>;
  labels: { visitors: string; pageviews: string };
}) {
  const W = 720;
  const H = 200;
  const padX = 6;
  const padTop = 10;
  const padBottom = 22;
  const n = series.length;
  const max = Math.max(1, ...series.map((s) => s.pageviews), ...series.map((s) => s.visitors));
  const x = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * padX));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const path = (key: 'visitors' | 'pageviews') =>
    series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(' ');
  const area = `${path('pageviews')} L${x(n - 1).toFixed(1)},${(H - padBottom).toFixed(1)} L${x(0).toFixed(1)},${(H - padBottom).toFixed(1)} Z`;
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];

  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Traffic over time" preserveAspectRatio="none" style={{ height: 200 }}>
        {/* baseline */}
        <line x1={padX} y1={H - padBottom} x2={W - padX} y2={H - padBottom} style={{ stroke: 'hsl(var(--border))' }} strokeWidth={1} />
        <path d={area} style={{ fill: 'hsl(var(--primary))', opacity: 0.1 }} />
        <path d={path('pageviews')} fill="none" style={{ stroke: 'hsl(var(--primary))' }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path('visitors')} fill="none" style={{ stroke: 'hsl(var(--muted-foreground))' }} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}>
            {series[i]?.date.slice(5)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: 'hsl(var(--primary))' }} />{labels.pageviews}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0 w-3 border-t-2 border-dashed" style={{ borderColor: 'hsl(var(--muted-foreground))' }} />{labels.visitors}</span>
      </div>
    </div>
  );
}
