'use client';

import { useState } from 'react';
import { pick } from '@/lib/admin-i18n';

/** Visual-only frequency picker for the Refill landing (no recurring billing). */
export function RefillFrequency({ locale }: { locale: string }) {
  const t = pick(locale);
  const [freq, setFreq] = useState(30);
  return (
    <div className="mt-[22px] flex flex-wrap gap-2.5">
      {[30, 45, 60, 90].map((f) => {
        const on = freq === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => setFreq(f)}
            aria-pressed={on}
            className={`rounded-full px-5 py-3 text-sm font-bold transition-colors ${
              on ? 'bg-green-dark text-white' : 'border border-[color:var(--slate-border)] bg-white text-slate'
            }`}
          >
            {t(`Every ${f} days`, `كل ${f} يومًا`)}
          </button>
        );
      })}
    </div>
  );
}
