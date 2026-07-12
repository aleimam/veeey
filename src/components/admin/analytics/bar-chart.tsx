'use client';

import { useState } from 'react';

export type BarDatum = { label: string; value: number };

/** Responsive, interactive bar chart (hover shows the exact value). `unit`
 *  controls formatting: 'egp' divides piastres → EGP, 'count' shows the number. */
export function BarChart({ data, unit = 'count', color = 'var(--primary)' }: { data: BarDatum[]; unit?: 'egp' | 'count'; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (v: number) => (unit === 'egp' ? `EGP ${Math.round(v / 100).toLocaleString('en-US')}` : v.toLocaleString('en-US'));

  return (
    <div className="w-full select-none">
      <div className="flex h-44 items-end gap-1.5">
        {data.map((d, i) => (
          <button
            type="button"
            key={d.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
          >
            {hover === i && (
              <span className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow">
                {d.label}: {fmt(d.value)}
              </span>
            )}
            <span
              className="w-full max-w-[52px] rounded-t-md transition-[height,opacity] group-hover:opacity-80"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0, background: color }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex-1 truncate text-center text-[10px] leading-tight text-muted-foreground" title={d.label}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}
