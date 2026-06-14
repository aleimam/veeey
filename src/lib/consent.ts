'use client';

/**
 * Consent state (FR-BEH-02). Single client-side source of truth shared by the
 * consent banner and the analytics layer, so granting consent takes effect
 * immediately (custom event, since same-tab localStorage writes don't fire
 * the native `storage` event). Modes:
 *   - null         : no choice yet → anonymized-until-consent (first-party only)
 *   - 'necessary'  : essential first-party only, no third-party trackers
 *   - 'all'        : first-party + PostHog/Clarity + customer linking
 */
export type ConsentValue = 'all' | 'necessary' | null;

const KEY = 'veeey-consent';
const EVENT = 'veeey-consent-change';

export function getConsent(): ConsentValue {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'all' || v === 'necessary' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: 'all' | 'necessary'): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function subscribeConsent(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
