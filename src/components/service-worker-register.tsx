'use client';

import { useEffect } from 'react';

/**
 * Registers the offline-shell service worker (FR-PLAT-03). Production only, so
 * dev hot-reload isn't intercepted by a cached shell.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Registration is best-effort; the site works without it.
    });
  }, []);

  return null;
}
