'use client';

import { useEffect, useSyncExternalStore } from 'react';
import posthog from 'posthog-js';
import { getConsent, subscribeConsent } from '@/lib/consent';

let initialized = false;

/**
 * PostHog product analytics (FR-BEH-02). Loads only when the visitor grants full
 * consent and a key is configured — nothing is sent before then.
 */
export function PostHogLoader() {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (consent === 'all' && key && !initialized) {
      initialized = true;
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
      });
    }
  }, [consent]);

  return null;
}
