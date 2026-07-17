import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { FilterBar, type FilterField } from './filter-bar';

const fields: FilterField[] = [
  { name: 'q', label: 'Search', type: 'text' },
  { name: 'status', label: 'Status', type: 'select', options: [{ value: 'PENDING', label: 'PENDING' }] },
];

const hidden = (name: string) => document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);

describe('FilterBar', () => {
  it('renders its own fields with the active values', () => {
    render(<FilterBar fields={fields} values={{ q: 'abc' }} locale="en" path="orders" />);
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('abc');
  });

  // V6 S13/S10: Sales links land here carrying filters the bar has no field for.
  // Submitting used to drop them — the list silently widened while the header
  // still said "filtered".
  it('carries kept params through a submit as hidden inputs', () => {
    render(<FilterBar fields={fields} values={{}} locale="en" path="orders" keep={{ minTotal: '500', productId: 'p1' }} />);
    expect(hidden('minTotal')?.value).toBe('500');
    expect(hidden('productId')?.value).toBe('p1');
  });

  it('ignores kept params that are not set', () => {
    render(<FilterBar fields={fields} values={{}} locale="en" path="orders" keep={{ minTotal: undefined, maxTotal: '' }} />);
    expect(hidden('minTotal')).toBeNull();
    expect(hidden('maxTotal')).toBeNull();
  });

  it('offers Clear when only a kept param is active — otherwise it would look unfiltered', () => {
    render(<FilterBar fields={fields} values={{}} locale="en" path="orders" keep={{ productId: 'p1' }} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('has no Clear when nothing is filtered', () => {
    render(<FilterBar fields={fields} values={{}} locale="en" path="orders" />);
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });
});
