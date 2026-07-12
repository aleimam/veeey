/**
 * Product-photo watermark settings (pure module — no prisma/sharp, vitest-safe).
 * The service (watermark-service.ts) composites with sharp using these values.
 */
export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type WatermarkLogo = 'icon' | 'horizontal' | 'transparent';

export type WatermarkSettings = {
  logo: WatermarkLogo;
  position: WatermarkPosition;
  sizePct: number; // watermark width as % of the base image width (5–60)
  opacity: number; // 0–100
  marginPct: number; // margin from the edge as % of image width (0–20)
  autoStamp: boolean; // stamp new product-image uploads automatically
};

export const DEFAULT_WATERMARK: WatermarkSettings = {
  logo: 'icon',
  position: 'bottom-right',
  sizePct: 18,
  opacity: 70,
  marginPct: 4,
  autoStamp: false,
};

export const WATERMARK_POSITIONS: WatermarkPosition[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const clamp = (n: number, lo: number, hi: number, dflt: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt);

export function parseWatermark(raw: Record<string, string | undefined>): WatermarkSettings {
  const logo = (['icon', 'horizontal', 'transparent'] as const).find((l) => l === raw.logo) ?? DEFAULT_WATERMARK.logo;
  const position = WATERMARK_POSITIONS.find((p) => p === raw.position) ?? DEFAULT_WATERMARK.position;
  return {
    logo,
    position,
    sizePct: clamp(Number(raw.sizePct), 5, 60, DEFAULT_WATERMARK.sizePct),
    opacity: clamp(Number(raw.opacity), 0, 100, DEFAULT_WATERMARK.opacity),
    marginPct: clamp(Number(raw.marginPct), 0, 20, DEFAULT_WATERMARK.marginPct),
    autoStamp: raw.autoStamp === 'true',
  };
}

/**
 * Compute the top-left pixel offset for the watermark given the base and
 * watermark dimensions + a margin, for a chosen position. Pure geometry so it
 * can be unit-tested without sharp.
 */
export function computeOffset(
  base: { w: number; h: number },
  mark: { w: number; h: number },
  position: WatermarkPosition,
  margin: number,
): { left: number; top: number } {
  const [v, h] = splitPosition(position);
  const left = h === 'left' ? margin : h === 'right' ? base.w - mark.w - margin : Math.round((base.w - mark.w) / 2);
  const top = v === 'top' ? margin : v === 'bottom' ? base.h - mark.h - margin : Math.round((base.h - mark.h) / 2);
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

function splitPosition(p: WatermarkPosition): [v: 'top' | 'center' | 'bottom', h: 'left' | 'center' | 'right'] {
  if (p === 'center') return ['center', 'center'];
  const [a, b] = p.split('-') as ['top' | 'center' | 'bottom', 'left' | 'center' | 'right'];
  return [a, b];
}

/** CSS flex alignment for the live preview overlay (mirrors the sharp gravity). */
export function previewAlign(position: WatermarkPosition): { justify: string; align: string } {
  const [v, h] = splitPosition(position);
  const map = { left: 'flex-start', center: 'center', right: 'flex-end', top: 'flex-start', bottom: 'flex-end' } as const;
  return { justify: map[h], align: map[v] };
}
