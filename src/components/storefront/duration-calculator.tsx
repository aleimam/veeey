'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * "How long will this last" duration calculator (FR-HEALTH-01). Uses the
 * product's servings-per-unit and a daily dosage the customer can adjust.
 */
export function DurationCalculator({
  servings,
  defaultDosage,
}: {
  servings: number;
  defaultDosage: number;
}) {
  const t = useTranslations('storefront.duration');
  const [dosage, setDosage] = useState(Math.max(1, defaultDosage || 1));
  const days = Math.floor(servings / dosage);
  const months = Math.floor(days / 30);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <label className="text-muted-foreground" htmlFor="dosage">{t('perDay')}</label>
        <input
          id="dosage"
          type="number"
          min={1}
          value={dosage}
          onChange={(e) => setDosage(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-md border border-border bg-card px-2 py-1 text-sm"
        />
      </div>
      <p className="mt-3 text-foreground">
        <span className="text-2xl font-semibold text-primary">{days}</span> {t('days')}
        {months >= 1 && <span className="text-muted-foreground"> {t('months', { months })}</span>}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t('formula', { servings, dosage })}</p>
    </div>
  );
}
