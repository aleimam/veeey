import type { HTMLAttributes, ReactNode } from 'react';

/** Veeey Card — surface container with subtle premium elevation. */
export function Card({
  children,
  hover = false,
  pad = false,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean; pad?: boolean; children: ReactNode }) {
  const cls = ['v-card', hover ? 'v-card--hover' : '', pad ? 'v-card--pad' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
