import { describe, it, expect } from 'vitest';
import { trendDirection, trendToneClass, trendCornerClass, deltaAriaLabel } from './kpi-trend';

const WORDS = { up: 'up', down: 'down', flat: 'unchanged', vs: 'vs yesterday' };

describe('KPI trend mapping (V5 audit D-01)', () => {
  it('positive delta → up / success tones', () => {
    expect(trendDirection(12)).toBe('up');
    expect(trendToneClass(12)).toBe('text-primary');
    expect(trendCornerClass(12)).toContain('text-primary');
  });

  it('negative delta → down / destructive tones', () => {
    expect(trendDirection(-8)).toBe('down');
    expect(trendToneClass(-8)).toBe('text-destructive');
    expect(trendCornerClass(-8)).toContain('text-destructive');
  });

  it('zero delta → flat / neutral tones (never "up")', () => {
    expect(trendDirection(0)).toBe('flat');
    expect(trendToneClass(0)).toBe('text-muted-foreground');
    expect(trendCornerClass(0)).toContain('text-muted-foreground');
  });
});

describe('delta aria-label (V5 audit D-13)', () => {
  it('describes direction + magnitude', () => {
    expect(deltaAriaLabel(12, WORDS)).toBe('up 12% vs yesterday');
    expect(deltaAriaLabel(-8, WORDS)).toBe('down 8% vs yesterday');
  });

  it('zero reads as unchanged without a percentage', () => {
    expect(deltaAriaLabel(0, WORDS)).toBe('unchanged vs yesterday');
  });
});
