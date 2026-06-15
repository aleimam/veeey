'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';

const KEY = 'veeey-disclaimer';

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}
function getStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** First-visit supplement disclaimer pop-up (FR-SF-04). */
export function EntryDisclaimer() {
  const t = useTranslations('storefront.disclaimer');
  const stored = useSyncExternalStore(subscribe, getStored, () => null);
  const [dismissed, setDismissed] = useState(false);

  function accept() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  if (stored !== null || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/40 p-4" role="dialog" aria-modal="true">
      <div className="max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="font-heading text-lg font-semibold text-foreground">{t('title')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t('body')}
        </p>
        <button
          onClick={accept}
          className="mt-5 w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90"
        >
          {t('accept')}
        </button>
      </div>
    </div>
  );
}
