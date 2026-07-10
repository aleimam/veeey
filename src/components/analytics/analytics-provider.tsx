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

/** Screen + viewport + language for the session payload (best-effort). */
function readClientEnv() {
  try {
    return {
      language: navigator.language || undefined,
      screenW: window.screen?.width || undefined,
      screenH: window.screen?.height || undefined,
      viewportW: window.innerWidth || undefined,
      viewportH: window.innerHeight || undefined,
    };
  } catch {
    return {};
  }
}

const MAX_DWELL = 6 * 60 * 60 * 1000; // 6h — anything longer is a stuck tab, drop it

/**
 * First-party clickstream provider (FR-BEH-01 + Analytics P1). Batches events and
 * flushes via sendBeacon. Tracks per-page dwell time by emitting a `page_leave`
 * event (with durationMs) whenever the visitor navigates away, hides the tab, or
 * closes the page. Consent is read live and forwarded so the server only stores
 * identifying data under full consent.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  const pathname = usePathname();

  const queue = useRef<ClientEvent[]>([]);
  const sid = useRef<string>('');
  const consentRef = useRef(consent);
  const pageEnter = useRef<number>(0); // stamped on the first route effect (mount)
  const pagePath = useRef<string>('');

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
      ...readClientEnv(),
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

  // Emit a page_leave (with dwell time) for the page we're leaving, then reset the
  // timer so a subsequent hide+navigate doesn't double-count.
  const leaveCurrentPage = useCallback(() => {
    const path = pagePath.current;
    if (!path) return;
    const dur = Date.now() - pageEnter.current;
    pageEnter.current = Date.now();
    if (dur > 0 && dur < MAX_DWELL) {
      queue.current.push({ name: 'page_leave', path, durationMs: dur, ts: Date.now() });
    }
  }, []);

  // Route change → close out the previous page, open the new one.
  useEffect(() => {
    leaveCurrentPage();
    pagePath.current = typeof location !== 'undefined' ? location.pathname : pathname;
    pageEnter.current = Date.now();
    track('page_view');
  }, [pathname, track, leaveCurrentPage]);

  // Periodic flush + close out the page on hide/leave.
  useEffect(() => {
    const interval = setInterval(flush, 5000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') leaveCurrentPage();
      flush();
    };
    const onShow = () => {
      if (document.visibilityState === 'visible') pageEnter.current = Date.now();
    };
    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pagehide', onHide);
      leaveCurrentPage();
      flush();
    };
  }, [flush, leaveCurrentPage]);

  return <TrackContext.Provider value={track}>{children}</TrackContext.Provider>;
}
