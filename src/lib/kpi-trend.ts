/**
 * KPI delta → trend presentation (V5 audit D-01/D-12/D-13). Pure so the
 * icon/color mapping and the aria-label wording are unit-testable: the corner
 * trend icon and the delta line must follow the SIGN of the delta — up →
 * trending-up/success, down → trending-down/destructive, zero → neutral —
 * never a hardcoded "up".
 */
export type TrendDirection = 'up' | 'down' | 'flat';

export function trendDirection(delta: number): TrendDirection {
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
}

/** Text tone for the delta line under the KPI value. */
export function trendToneClass(delta: number): string {
  return delta > 0 ? 'text-primary' : delta < 0 ? 'text-destructive' : 'text-muted-foreground';
}

/** Corner icon chip tone (mirrors the delta line, softer background). */
export function trendCornerClass(delta: number): string {
  return delta > 0
    ? 'bg-primary/10 text-primary'
    : delta < 0
      ? 'bg-destructive/10 text-destructive'
      : 'bg-muted text-muted-foreground';
}

/** Accessible description of a delta, language-agnostic (caller passes words). */
export function deltaAriaLabel(
  delta: number,
  words: { up: string; down: string; flat: string; vs: string },
): string {
  if (delta === 0) return `${words.flat} ${words.vs}`;
  return `${delta > 0 ? words.up : words.down} ${Math.abs(delta)}% ${words.vs}`;
}
