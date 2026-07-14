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
      // Rank among UNIQUE product slugs in DOM order — a card has several
      // /products/ links (image + title), so indexing raw links doubled the
      // reported position.
      const seen: string[] = [];
      for (const link of el.querySelectorAll('a[href*="/products/"]')) {
        const mm = link.getAttribute('href')?.match(/\/products\/([^/?#]+)/);
        const s = mm?.[1] ? decodeURIComponent(mm[1]) : null;
        if (s && !seen.includes(s)) seen.push(s);
      }
      const position = Math.max(0, seen.indexOf(slug));
      navigator.sendBeacon?.('/api/search/click', new Blob([JSON.stringify({ term, slug, position, source: 'results' })], { type: 'application/json' }));
    };
    el.addEventListener('click', onClick, true);
    return () => el.removeEventListener('click', onClick, true);
  }, [term]);

  return <div ref={ref}>{children}</div>;
}
