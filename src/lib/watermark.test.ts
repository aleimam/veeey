import { describe, expect, it } from 'vitest';
import { parseWatermark, computeOffset, previewAlign, DEFAULT_WATERMARK } from '@/lib/watermark';

describe('watermark settings', () => {
  it('defaults an empty map and clamps out-of-range values', () => {
    expect(parseWatermark({})).toEqual(DEFAULT_WATERMARK);
    const w = parseWatermark({ sizePct: '999', opacity: '-5', marginPct: '50', logo: 'bogus', position: 'nope' });
    expect(w.sizePct).toBe(60);
    expect(w.opacity).toBe(0);
    expect(w.marginPct).toBe(20);
    expect(w.logo).toBe('icon');
    expect(w.position).toBe('bottom-right');
  });

  it('reads valid values + autoStamp', () => {
    const w = parseWatermark({ logo: 'horizontal', position: 'top-left', sizePct: '25', opacity: '80', marginPct: '3', autoStamp: 'true' });
    expect(w).toEqual({ logo: 'horizontal', position: 'top-left', sizePct: 25, opacity: 80, marginPct: 3, autoStamp: true });
  });

  it('computes offsets for each corner + center', () => {
    const base = { w: 1000, h: 800 };
    const mark = { w: 200, h: 100 };
    expect(computeOffset(base, mark, 'top-left', 40)).toEqual({ left: 40, top: 40 });
    expect(computeOffset(base, mark, 'bottom-right', 40)).toEqual({ left: 760, top: 660 });
    expect(computeOffset(base, mark, 'center', 0)).toEqual({ left: 400, top: 350 });
    expect(computeOffset(base, mark, 'bottom-center', 20)).toEqual({ left: 400, top: 680 });
  });

  it('never returns a negative offset', () => {
    expect(computeOffset({ w: 100, h: 100 }, { w: 200, h: 200 }, 'bottom-right', 10)).toEqual({ left: 0, top: 0 });
  });

  it('maps positions to CSS alignment for the preview', () => {
    expect(previewAlign('top-left')).toEqual({ justify: 'flex-start', align: 'flex-start' });
    expect(previewAlign('bottom-right')).toEqual({ justify: 'flex-end', align: 'flex-end' });
    expect(previewAlign('center')).toEqual({ justify: 'center', align: 'center' });
  });
});
