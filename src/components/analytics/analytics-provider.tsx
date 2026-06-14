'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { usePathname } from '@/i18n/navigation';
import { getConsent, subscribeConsent } from '@/lib/consent';
import type { ClientEvent } from '@/lib/analytics/events';

type TrackFn = (name: string, props?: Record<string, unknown>) => void;
const TrackContext = createContext<TrackFn>(() => {});
export const useTrack = () => useContext(TrackContext);

function getSessionId(): string {
  try {
    let id = localStorage.getItem('veeey-sid');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('veeey-sid', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

function readUtm(): Record<string, string> {
  const utm: Record<string, string> = {};
  try {
    new URLSearchParams(location.search).forEach((v, k) => {
      if (k.startsWith('utm_')) utm[k] = v;
    });
  } catch {
    // ignore
  }
  return utm;
}

/**
 * First-party clickstream provider (FR-BEH-01). Batches events and flushes via
 * sendBeacon. Consent is read live from the shared consent module and forwarded
 * so the server only links a customer under full consent.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  const pathname = usePathname();

  const queue = useRef<ClientEvent[]>([]);
  const sid = useRef<string>('');
  const consentRef = useRef(consent);

  useEffect(() => {
    consentRef.current = consent;
  }, [consent]);

  const flush = useCallback(() => {
    if (typeof navigator === 'undefined' || queue.current.length === 0) return;
    if (!sid.current) sid.current = getSessionId();
    const events = queue.current;
    queue.current = [];
    const body = JSON.stringify({
      sessionId: sid.current,
      consent: consentRef.current,
      referrer: document.referrer || undefined,
      utm: readUtm(),
      events,
    });
    try {
      const ok = navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }));
      if (!ok) throw new Error('beacon failed');
    } catch {
      fetch('/api/events', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
    }
  }, []);

  const track = useCallback<TrackFn>(
    (name, props) => {
      queue.current.push({ name, path: typeof location !== 'undefined' ? location.pathname : undefined, props, ts: Date.now() });
      if (queue.current.length >= 10) flush();
    },
    [flush],
  );

  // Auto page-view on every route change.
  useEffect(() => {
    track('page_view');
  }, [pathname, track]);

  // Periodic + on-leave flush.
  useEffect(() => {
    const interval = setInterval(flush, 5000);
    const onHide = () => flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  return <TrackContext.Provider value={track}>{children}</TrackContext.Provider>;
}
