import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const usePathname = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => usePathname() }));

import { StorefrontOnly } from './storefront-only';

afterEach(() => usePathname.mockReset());

// V6 audit S15: the layout wraps GA4/GTM, PostHog and Clarity in this gate.
describe('StorefrontOnly', () => {
  it('renders the tags on storefront pages', () => {
    usePathname.mockReturnValue('/en/category/vitamins');
    render(<StorefrontOnly><span>tag</span></StorefrontOnly>);
    expect(screen.getByText('tag')).toBeInTheDocument();
  });

  it('renders nothing on admin pages — the tags never reach the browser', () => {
    usePathname.mockReturnValue('/en/admin/orders');
    const { container } = render(<StorefrontOnly><span>tag</span></StorefrontOnly>);
    expect(container).toBeEmptyDOMElement();
  });

  it('covers the Arabic admin too', () => {
    usePathname.mockReturnValue('/ar/admin');
    const { container } = render(<StorefrontOnly><span>tag</span></StorefrontOnly>);
    expect(container).toBeEmptyDOMElement();
  });
});
