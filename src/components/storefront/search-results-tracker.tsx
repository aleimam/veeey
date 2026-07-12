'use client';

import { useEffect, useRef } from 'react';

/** Beacons a search-result click (which product, at what position) so the search
 *  dashboard can compute CTR + purchase-driving terms. Wraps the results grid;
 *  captures clicks bubbling up from product links. */
export function SearchResultsTracker({ term, children }: { term: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest('a[href*="/products/"]') as HTMLAnchorElement | null;
      if (!a) return;
      const m = a.getAttribute('href')?.match(/\/products\/([^/?#]+)/);
      const slug = m?.[1] ? decodeURIComponent(m[1]) : undefined;
      if (!slug) return;
      const cards = Array.from(el.querySelectorAll('a[href*="/products/"]'));
      const position = Math.max(0, cards.indexOf(a));
      navigator.sendBeacon?.('/api/search/click', new Blob([JSON.stringify({ term, slug, position, source: 'results' })], { type: 'application/json' }));
    };
    el.addEventListener('click', onClick, true);
    return () => el.removeEventListener('click', onClick, true);
  }, [term]);

  return <div ref={ref}>{children}</div>;
}
