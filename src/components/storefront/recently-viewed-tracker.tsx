'use client';

import { useEffect } from 'react';

/**
 * Records a viewed product into a server-readable `veeey-recent` cookie (most
 * recent first, deduped, capped at 12) — powers the "Recently viewed" and
 * "Recommended for you" rows (FR-PERS-02/04) without needing the analytics store.
 */
export function RecentlyViewedTracker({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const raw = document.cookie.split('; ').find((c) => c.startsWith('veeey-recent='))?.split('=')[1];
      const ids: string[] = raw ? JSON.parse(decodeURIComponent(raw)) : [];
      const next = [productId, ...ids.filter((i) => i !== productId)].slice(0, 12);
      document.cookie = `veeey-recent=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    } catch {
      // ignore
    }
  }, [productId]);
  return null;
}
