import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { DateRangeControls, type ControlLabels } from './date-range-controls';

const labels: ControlLabels = {
  period: 'Period',
  from: 'From',
  to: 'To',
  presets: { mtd: 'Month to date', '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', custom: 'Custom range' },
};

const setup = (props: Partial<Parameters<typeof DateRangeControls>[0]> = {}) =>
  render(<DateRangeControls preset="mtd" from="" to="" max="2026-07-17" labels={labels} {...props} />);

const period = () => screen.getByLabelText('Period') as HTMLSelectElement;
const fromInput = () => screen.getByLabelText('From') as HTMLInputElement;
const toInput = () => screen.getByLabelText('To') as HTMLInputElement;
const setValue = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

describe('DateRangeControls (V6 audit S1/S14)', () => {
  it('S1: editing a date switches the mode to Custom, so Apply works in one step', () => {
    setup({ preset: '7d' });
    expect(period().value).toBe('7d');

    setValue(fromInput(), '2026-03-01');

    expect(period().value).toBe('custom');
  });

  it('S1: once custom, the dates carry names so they are actually submitted', () => {
    setup({ preset: '7d' });
    setValue(fromInput(), '2026-03-01');
    setValue(toInput(), '2026-03-31');

    expect(fromInput()).toHaveAttribute('name', 'from');
    expect(toInput()).toHaveAttribute('name', 'to');
  });

  it('S14: picking a non-custom preset clears the dates', () => {
    setup({ preset: 'custom', from: '2026-03-01', to: '2026-03-31' });
    expect(fromInput().value).toBe('2026-03-01');

    setValue(period(), '7d');

    expect(fromInput().value).toBe('');
    expect(toInput().value).toBe('');
  });

  it('S14: a non-custom preset drops the date names so stale bounds are never submitted', () => {
    setup({ preset: 'custom', from: '2026-03-01', to: '2026-03-31' });
    expect(fromInput()).toHaveAttribute('name', 'from');

    setValue(period(), '7d');

    // No name => the browser omits them => the URL only carries ?preset=7d.
    // Without this the resolver's "explicit bounds win" rule (V5 F10) would keep
    // forcing custom, so picking a preset would silently do nothing.
    expect(fromInput()).not.toHaveAttribute('name');
    expect(toInput()).not.toHaveAttribute('name');
  });

  it('keeps the preset submittable at all times', () => {
    setup({ preset: '30d' });
    expect(period()).toHaveAttribute('name', 'preset');
  });

  it('F9 (V5): To cannot precede From', () => {
    setup({ preset: 'custom' });
    setValue(fromInput(), '2026-03-10');
    expect(toInput()).toHaveAttribute('min', '2026-03-10');
  });
});
