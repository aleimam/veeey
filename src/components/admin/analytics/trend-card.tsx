'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { BarChart, type BarDatum } from './bar-chart';

type Gran = 'days' | 'weeks' | 'months';

/**
 * Interactive dashboard trend card: a segmented 7 days / 7 weeks / 7 months toggle
 * over a shared BarChart. All three series are precomputed server-side and swapped
 * client-side, so switching granularity is instant (no round-trip). The header
 * total (and optional drill-through link) tracks the active granularity.
 */
export function TrendCard({
  title,
  unit = 'count',
  color,
  series,
  totals,
  hrefs,
  tabLabels,
  emptyLabel,
}: {
  title: string;
  unit?: 'egp' | 'count';
  color?: string;
  series: Record<Gran, BarDatum[]>;
  /** Pre-formatted totals (money via formatEGP, or a plain count) per granularity. */
  totals: Record<Gran, string>;
  /** Optional drill-through target per granularity; the total renders as a link. */
  hrefs?: Record<Gran, string>;
  tabLabels: Record<Gran, string>;
  emptyLabel?: string;
}) {
  const [g, setG] = useState<Gran>('days');
  const grans: Gran[] = ['days', 'weeks', 'months'];
  const total = totals[g];
  const href = hrefs?.[g];

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {href ? (
          <Link href={href} className="text-sm font-medium text-muted-foreground hover:text-primary hover:underline">{total}</Link>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">{total}</span>
        )}
      </div>
      <div className="mb-3 inline-flex rounded-lg border border-border p-0.5 text-xs" role="tablist" aria-label={title}>
        {grans.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={g === k}
            onClick={() => setG(k)}
            className={`rounded-md px-2.5 py-1 transition ${g === k ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tabLabels[k]}
          </button>
        ))}
      </div>
      <BarChart data={series[g]} unit={unit} color={color} emptyLabel={emptyLabel} />
    </div>
  );
}
