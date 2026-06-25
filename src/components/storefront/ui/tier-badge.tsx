import type { HTMLAttributes } from 'react';

export type Tier = 'green' | 'ip' | 'select';

const TIERS: Record<Tier, { label: string; mark: string }> = {
  green: { label: 'Veeey Green', mark: 'V' },
  ip: { label: 'VeeeyIP', mark: '★' },
  select: { label: 'Veeey Select', mark: '◆' },
};

/**
 * Veeey TierBadge — loyalty-tier marker (Green / VeeeyIP / Select). Pass
 * `label` to localise (e.g. the Arabic tier name).
 */
export function TierBadge({
  tier = 'green',
  label,
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tier?: Tier; label?: string }) {
  const t = TIERS[tier] ?? TIERS.green;
  return (
    <span className={['v-tier', `v-tier--${tier}`, className].filter(Boolean).join(' ')} {...rest}>
      <span className="v-tier__mark" aria-hidden="true">
        {t.mark}
      </span>
      {label ?? t.label}
    </span>
  );
}
