'use client';

import { useState } from 'react';

export type BarDatum = { label: string; value: number };

/**
 * Responsive, interactive bar chart. `unit` controls formatting: 'egp' divides
 * piastres → EGP, 'count' shows the number.
 *
 * V6 audit S5/S7/S8:
 *  S5 — labels used to `truncate`, so "3000–5000" became "3000…" and the last
 *       band clipped on a phone. They now wrap instead; nothing is ever cut.
 *       Columns are min-w-0 so the flex row can't push the card sideways.
 *  S7 — the tooltip hung off the top of the bar (`-top-1 -translate-y-full`),
 *       which for a full-height bar landed on the card heading, and off the
 *       card entirely at the first/last bar. It now renders inside the plot and
 *       flips its alignment at the edges.
 *  S8 — every bar carries its value, so the numbers are readable without a
 *       hover the user may not have (touch) or think to try.
 */
export function BarChart({
  data,
  unit = 'count',
  color = 'var(--primary)',
  emptyLabel,
}: {
  data: BarDatum[];
  unit?: 'egp' | 'count';
  color?: string;
  /** Shown instead of a flat baseline when there is nothing to plot (V6 S2). */
  emptyLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (v: number) => (unit === 'egp' ? `EGP ${Math.round(v / 100).toLocaleString('en-US')}` : v.toLocaleString('en-US'));
  // On-bar labels must fit a ~50px column, so they compact (1.2K); the tooltip,
  // aria-label and data table keep the exact figure.
  const fmtShort = (v: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(unit === 'egp' ? Math.round(v / 100) : v);

  if (emptyLabel && !data.some((d) => d.value > 0)) {
    return (
      <div className="flex h-44 w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="w-full select-none">
      <div className="flex h-44 items-end gap-1.5">
        {data.map((d, i) => (
          <button
            type="button"
            key={d.label}
            aria-label={`${d.label}: ${fmt(d.value)}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            {hover === i && (
              <span
                className={`absolute top-0 z-10 max-w-[12rem] truncate rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow ${
                  // Edge-flip: centering these would hang off the card.
                  i === 0 ? 'start-0' : i === data.length - 1 ? 'end-0' : 'start-1/2 -translate-x-1/2 rtl:translate-x-1/2'
                }`}
              >
                {d.label}: {fmt(d.value)}
              </span>
            )}
            <span aria-hidden className="text-[10px] font-medium leading-none text-muted-foreground">{fmtShort(d.value)}</span>
            {/* The track takes the height left over by the value label, so a
                full-height bar scales inside it instead of overflowing. */}
            <span className="flex w-full flex-1 items-end justify-center">
              <span
                className="w-full max-w-[52px] rounded-t-md transition-[height,opacity] group-hover:opacity-80"
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0, background: color }}
              />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d) => (
          <div key={d.label} className="min-w-0 flex-1 break-words text-center text-[10px] leading-tight text-muted-foreground">{d.label}</div>
        ))}
      </div>
      {/* accessible data table (V5 audit D-11) */}
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><td>{d.label}</td><td>{fmt(d.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
