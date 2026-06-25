import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'lime' | 'green' | 'error';

/** Veeey Badge — compact count or status marker. */
export function Badge({
  children,
  variant = 'lime',
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={['v-badge', `v-badge--${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}
