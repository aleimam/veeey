'use client';

import { useEffect, useRef } from 'react';
import { useTrack } from './analytics-provider';

/**
 * Fires a single analytics event when mounted — used by server pages to record
 * a view (e.g. product_view, search) without becoming client components.
 */
export function TrackView({ name, props }: { name: string; props?: Record<string, unknown> }) {
  const track = useTrack();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(name, props);
  }, [name, props, track]);
  return null;
}
