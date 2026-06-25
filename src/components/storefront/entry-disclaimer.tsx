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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" style={{ background: 'var(--scrim)' }}>
      <div className="max-w-md rounded-[16px] bg-white p-6 shadow-[var(--shadow-lg)]">
        <h2 className="text-xl font-bold text-green-dark">{t('title')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">{t('body')}</p>
        <button onClick={accept} className="v-btn v-btn--primary v-btn--block mt-5">
          {t('accept')}
        </button>
      </div>
    </div>
  );
}
