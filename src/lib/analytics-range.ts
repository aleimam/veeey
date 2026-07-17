/**
 * Shared analytics date-range resolution (V5 audit F9/F10/F11). One URL
 * contract for the analytics dashboard, Sales and the Report builder:
 *   ?preset=mtd|7d|30d|90d|custom [&from=YYYY-MM-DD&to=YYYY-MM-DD]
 * Legacy `?days=7|30|90` (old dashboard links) still resolves. Inverted custom
 * ranges are AUTO-SWAPPED (never silently empty) and flagged so the page can
 * show inline feedback. Pure — unit-tested without a DB.
 */
export type AnalyticsPreset = 'mtd' | '7d' | '30d' | '90d' | 'custom';

export type ResolvedRange = {
  preset: AnalyticsPreset;
  /** Window length in days (integer ≥ 1). */
  days: number;
  /** Window end anchor; undefined = "now" (loaders default to now). */
  endAt?: Date;
  /** Normalized custom bounds (YYYY-MM-DD) when preset=custom. */
  from: string | null;
  to: string | null;
  /** True when an inverted from/to was auto-corrected (F9). */
  swapped: boolean;
};

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseYmd = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : null);

const PRESET_DAYS: Record<Exclude<AnalyticsPreset, 'custom' | 'mtd'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

export function resolveAnalyticsRange(
  sp: { preset?: string; days?: string; from?: string; to?: string },
  opts: { defaultPreset?: AnalyticsPreset; now?: Date } = {},
): ResolvedRange {
  const now = opts.now ?? new Date();
  let fromD = parseYmd(sp.from);
  let toD = parseYmd(sp.to);
  let swapped = false;
  if (fromD && toD && fromD > toD) {
    [fromD, toD] = [toD, fromD];
    swapped = true;
  }

  // Explicit custom bounds win over any preset.
  if (fromD && toD) {
    const endOfTo = new Date(toD.getFullYear(), toD.getMonth(), toD.getDate() + 1).getTime() - 1;
    return {
      preset: 'custom',
      days: Math.max(1, Math.ceil((endOfTo - fromD.getTime()) / 86_400_000)),
      endAt: new Date(endOfTo),
      from: ymd(fromD),
      to: ymd(toD),
      swapped,
    };
  }

  const legacyDays = Number(sp.days);
  const preset: AnalyticsPreset =
    sp.preset === 'mtd' || sp.preset === '7d' || sp.preset === '30d' || sp.preset === '90d'
      ? sp.preset
      : legacyDays === 7 ? '7d' : legacyDays === 30 ? '30d' : legacyDays === 90 ? '90d'
      : (opts.defaultPreset ?? '30d');

  if (preset === 'mtd') {
    // Month-to-date: from the 1st through now.
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = Math.max(1, Math.ceil((now.getTime() - startOfMonth.getTime()) / 86_400_000));
    return { preset, days, endAt: undefined, from: null, to: null, swapped: false };
  }

  return { preset, days: PRESET_DAYS[preset as '7d'], endAt: undefined, from: null, to: null, swapped: false };
}
