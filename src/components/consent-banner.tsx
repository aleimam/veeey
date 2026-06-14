'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { getConsent, setConsent, subscribeConsent } from '@/lib/consent';

/**
 * Consent banner (FR-BEH-02). Writes through the shared consent module so the
 * analytics layer (first-party pipeline + PostHog/Clarity) reacts immediately.
 */
export function ConsentBanner() {
  const t = useTranslations('consent');
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  const [dismissed, setDismissed] = useState(false);

  function choose(value: 'all' | 'necessary') {
    setConsent(value);
    setDismissed(true);
  }

  if (consent !== null || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-4 py-4 backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t('message')}</p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose('necessary')}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-surface"
          >
            {t('necessaryOnly')}
          </button>
          <button
            onClick={() => choose('all')}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
