import type { HTMLAttributes, ReactNode } from 'react';

export type ChipVariant = 'base' | 'sale' | 'soft' | 'outline' | 'neutral';

/**
 * Veeey Chip — small uppercase pill for expiry dates, sale flags, loyalty
 * info and filters.
 */
export function Chip({
  children,
  variant = 'base',
  dot = false,
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { variant?: ChipVariant; dot?: boolean; children: ReactNode }) {
  return (
    <span className={['v-chip', `v-chip--${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {dot && <span className="v-chip__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
