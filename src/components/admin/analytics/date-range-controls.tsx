'use client';

import { useState } from 'react';
import { inputCls } from '@/components/admin/ui';
import type { AnalyticsPreset } from '@/lib/analytics-range';

const PRESETS: AnalyticsPreset[] = ['mtd', '7d', '30d', '90d', 'custom'];

export type ControlLabels = {
  period: string;
  from: string;
  to: string;
  presets: Record<AnalyticsPreset, string>;
};

/**
 * The interactive half of the analytics period control (V6 audit S1/S14). Kept
 * in its own client module so `date-range.tsx` stays a Server Component and can
 * still export `dateRangeLabels()` for the pages to call.
 *
 * The two findings are opposite halves of one contract — the resolver lets
 * explicit bounds win over any preset (V5 F10), so the form must never emit a
 * mode the user didn't pick:
 *
 *  S1  — editing From/To flips the mode to Custom, so choosing dates and pressing
 *        Apply updates the data in ONE step (no "select Custom first" dance).
 *  S14 — choosing a non-custom preset clears the dates AND drops their `name`, so
 *        they aren't submitted at all. Without this, stale bounds from an earlier
 *        custom range keep winning and picking "Last 7 days" silently does
 *        nothing, while the URL advertises a mode that isn't in effect.
 */
export function DateRangeControls({
  preset: initialPreset,
  from: initialFrom,
  to: initialTo,
  max,
  labels,
}: {
  preset: AnalyticsPreset;
  from: string;
  to: string;
  /** Today (YYYY-MM-DD) — computed server-side so this stays render-pure. */
  max: string;
  labels: ControlLabels;
}) {
  const [preset, setPreset] = useState<AnalyticsPreset>(initialPreset);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const isCustom = preset === 'custom';

  const pickPreset = (p: AnalyticsPreset) => {
    setPreset(p);
    if (p !== 'custom') {
      setFrom('');
      setTo('');
    }
  };

  const editDate = (which: 'from' | 'to', v: string) => {
    if (which === 'from') setFrom(v);
    else setTo(v);
    if (v) setPreset('custom');
  };

  return (
    <>
      <label className="text-sm font-medium">
        {labels.period}
        <select
          name="preset"
          value={preset}
          onChange={(e) => pickPreset(e.target.value as AnalyticsPreset)}
          className={`${inputCls} w-44`}
        >
          {PRESETS.map((p) => (
            <option key={p} value={p}>{labels.presets[p]}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        {labels.from}
        <input
          type="date"
          // S14: no name while a preset is active → never submitted → clean URL.
          name={isCustom ? 'from' : undefined}
          value={from}
          onChange={(e) => editDate('from', e.target.value)}
          max={max}
          className={inputCls}
        />
      </label>
      <label className="text-sm font-medium">
        {labels.to}
        {/* F9 (V5): To can't precede From; the resolver still auto-swaps hand-typed URLs. */}
        <input
          type="date"
          name={isCustom ? 'to' : undefined}
          value={to}
          onChange={(e) => editDate('to', e.target.value)}
          min={from || undefined}
          max={max}
          className={inputCls}
        />
      </label>
    </>
  );
}
