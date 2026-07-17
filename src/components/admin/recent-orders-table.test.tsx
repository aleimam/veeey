import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('@/components/admin/ui', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

import { RecentOrdersTable } from './recent-orders-table';

const labels = { order: 'Order #', customer: 'Customer', total: 'Total', status: 'Status', date: 'Date' };
const rows = [
  { id: 'o1', number: 'VY-1001', customer: 'Ali Hassan', total: 'EGP 1,250', status: 'PENDING', date: '15/7' },
  { id: 'o2', number: 'VY-1002', customer: 'Guest', total: 'EGP 480', status: 'DELIVERED', date: '14/7' },
];

describe('RecentOrdersTable (V5 audit D-04)', () => {
  it('exposes a semantic header row with scoped columnheaders', () => {
    render(<RecentOrdersTable rows={rows} labels={labels} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Order #', 'Customer', 'Total', 'Status', 'Date']);
    for (const h of headers) expect(h.getAttribute('scope')).toBe('col');
  });

  it('renders each order as a row with a link to its detail page', () => {
    render(<RecentOrdersTable rows={rows} labels={labels} />);
    expect(screen.getAllByRole('row')).toHaveLength(3); // 1 header + 2 data
    const link = screen.getByRole('link', { name: 'VY-1001' });
    expect(link.getAttribute('href')).toBe('/admin/orders/o1');
  });

  it('scrolls inside its own container, never the page (V5 D-02)', () => {
    const { container } = render(<RecentOrdersTable rows={rows} labels={labels} />);
    expect((container.firstChild as HTMLElement).className).toContain('overflow-x-auto');
  });
});
