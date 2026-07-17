import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ComboFilter, type ComboOption } from './combo-filter';

const options: ComboOption[] = [
  { value: 'b1', label: 'NOW Foods' },
  { value: 'b2', label: 'Nordic Naturals' },
  { value: 'b3', label: 'Solgar' },
];

const input = () => screen.getByRole('combobox') as HTMLInputElement;
const hidden = () => document.querySelector<HTMLInputElement>('input[type="hidden"][name="brand"]')!;

// V7 audit C2: the brand filter was a native select with ~650 options.
describe('ComboFilter', () => {
  it('submits the picked id through the hidden input, not the typed text', () => {
    render(<ComboFilter name="brand" options={options} allLabel="All" />);
    fireEvent.change(input(), { target: { value: 'nordic' } });
    fireEvent.mouseDown(screen.getByText('Nordic Naturals'));
    expect(hidden().value).toBe('b2');
    expect(input().value).toBe('Nordic Naturals');
  });

  it('filters the list as you type', () => {
    render(<ComboFilter name="brand" options={options} allLabel="All" />);
    fireEvent.change(input(), { target: { value: 'sol' } });
    expect(screen.getByText('Solgar')).toBeInTheDocument();
    expect(screen.queryByText('NOW Foods')).not.toBeInTheDocument();
  });

  it('picks with the keyboard: ↓ then Enter', () => {
    render(<ComboFilter name="brand" options={options} allLabel="All" />);
    fireEvent.change(input(), { target: { value: 'no' } }); // NOW Foods + Nordic Naturals
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(hidden().value).toBe('b2'); // second match
  });

  it('shows the active filter when arriving with ?brand= in the URL', () => {
    render(<ComboFilter name="brand" options={options} value="b3" allLabel="All" />);
    expect(input().value).toBe('Solgar');
    expect(hidden().value).toBe('b3');
  });

  it('clearing the text clears the filter, and "All" resets explicitly', () => {
    render(<ComboFilter name="brand" options={options} value="b3" allLabel="All" />);
    fireEvent.change(input(), { target: { value: '' } });
    expect(hidden().value).toBe('');

    fireEvent.focus(input());
    fireEvent.mouseDown(screen.getByText('All'));
    expect(hidden().value).toBe('');
  });
});
