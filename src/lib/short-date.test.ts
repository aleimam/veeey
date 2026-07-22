import { describe, expect, it } from 'vitest';
import { shortDate } from '@/lib/format';

describe('shortDate', () => {
  it('renders DD/MM/YYYY', () => {
    expect(shortDate(new Date('2026-07-22T18:45:00Z'))).toBe('22/07/2026');
  });

  it('zero-pads day and month', () => {
    expect(shortDate(new Date('2026-01-05T00:00:00Z'))).toBe('05/01/2026');
  });

  it('accepts an ISO string as well as a Date', () => {
    expect(shortDate('2025-12-31T23:59:59Z')).toBe('31/12/2025');
  });

  it('uses UTC, so a late-evening order does not slide to the next day for some viewers', () => {
    // The whole point of not using toLocaleDateString: staff and customer must
    // agree on the date printed against an order.
    expect(shortDate('2026-07-22T23:30:00Z')).toBe('22/07/2026');
  });
});
