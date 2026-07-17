import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { BarChart, type BarDatum } from './bar-chart';

const bands: BarDatum[] = [
  { label: '0–500', value: 12 },
  { label: '500–1000', value: 40 },
  { label: '1000–2000', value: 8 },
  { label: '3000–5000', value: 0 },
  { label: '5000+', value: 2400 },
];

const bars = () => screen.getAllByRole('button');
/** The same text also lives in the sr-only data table — take the visible one. */
const axisLabel = (text: string) => screen.getAllByText(text).find((el) => el.tagName === 'DIV')!;

describe('BarChart (V6 audit S5/S7/S8)', () => {
  it('S8: shows every value without hovering', () => {
    render(<BarChart data={bands} unit="count" />);
    // Compacted to fit the column; 2400 → 2.4K.
    const expected = ['12', '40', '8', '0', '2.4K'];
    expected.forEach((text, i) => {
      expect(within(bars()[i]).getByText(text)).toBeInTheDocument();
    });
  });

  it('S8: the exact figure still reaches assistive tech and the tooltip', () => {
    render(<BarChart data={bands} unit="count" />);
    expect(bars()[4]).toHaveAttribute('aria-label', '5000+: 2,400');

    fireEvent.focus(bars()[4]);
    expect(screen.getByText('5000+: 2,400')).toBeInTheDocument();
  });

  it('formats EGP from piastres, compacting only the on-bar label', () => {
    render(<BarChart data={[{ label: 'Mar', value: 1_234_500 }]} unit="egp" />);
    expect(bars()[0]).toHaveAttribute('aria-label', 'Mar: EGP 12,345');
    expect(within(bars()[0]).getByText('12.3K')).toBeInTheDocument();
  });

  it('S5: axis labels wrap rather than truncate, so no band is cut off', () => {
    render(<BarChart data={bands} unit="count" />);
    const axis = axisLabel('3000–5000');
    expect(axis).not.toHaveClass('truncate');
    expect(axis).toHaveClass('break-words');
    expect(axis).toHaveClass('min-w-0'); // can't force the row wider than the card
  });

  it('S7: the tooltip stays inside the plot instead of rising into the heading', () => {
    render(<BarChart data={bands} unit="count" />);
    fireEvent.focus(bars()[1]);
    const tip = screen.getByText('500–1000: 40');
    expect(tip).toHaveClass('top-0');
    expect(tip.className).not.toMatch(/-translate-y-full/);
  });

  it('S7: the tooltip flips at the edges and centres in between', () => {
    render(<BarChart data={bands} unit="count" />);

    fireEvent.focus(bars()[0]);
    expect(screen.getByText('0–500: 12')).toHaveClass('start-0');

    fireEvent.focus(bars()[4]);
    expect(screen.getByText('5000+: 2,400')).toHaveClass('end-0');

    fireEvent.focus(bars()[2]);
    expect(screen.getByText('1000–2000: 8')).toHaveClass('-translate-x-1/2');
  });

  it('shows one tooltip at a time, and none at rest', () => {
    render(<BarChart data={bands} unit="count" />);
    expect(screen.queryByText('0–500: 12')).not.toBeInTheDocument();

    fireEvent.focus(bars()[0]);
    expect(screen.getByText('0–500: 12')).toBeInTheDocument();

    fireEvent.blur(bars()[0]);
    expect(screen.queryByText('0–500: 12')).not.toBeInTheDocument();
  });

  it('keeps the screen-reader data table (V5 D-11)', () => {
    const { container } = render(<BarChart data={bands} unit="count" />);
    const rows = container.querySelectorAll('table.sr-only tbody tr');
    expect(rows).toHaveLength(bands.length);
    expect(rows[4].textContent).toBe('5000+2,400');
  });

  it('survives an all-zero series without dividing by zero', () => {
    render(<BarChart data={[{ label: 'a', value: 0 }, { label: 'b', value: 0 }]} unit="count" />);
    expect(bars()[0]).toHaveAttribute('aria-label', 'a: 0');
  });

  it('S2: says so when there is nothing to plot, rather than drawing a flat baseline', () => {
    render(<BarChart data={[{ label: 'a', value: 0 }, { label: 'b', value: 0 }]} unit="count" emptyLabel="No customers yet" />);
    expect(screen.getByText('No customers yet')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('S2: a series with any data still plots, empty label or not', () => {
    render(<BarChart data={[{ label: 'a', value: 0 }, { label: 'b', value: 3 }]} unit="count" emptyLabel="No customers yet" />);
    expect(screen.queryByText('No customers yet')).not.toBeInTheDocument();
    expect(bars()).toHaveLength(2);
  });
});
