import type { HTMLAttributes } from 'react';

function Star({ fill }: { fill: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.94L12 2.5z"
        fill={fill ? 'var(--gold)' : 'none'}
        stroke="var(--gold)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Veeey Rating — gold star rating with optional value + review count. */
export function Rating({
  value = 0,
  count,
  showValue = false,
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { value?: number; count?: number; showValue?: boolean }) {
  const rounded = Math.round(value);
  return (
    <span className={['v-rating', className].filter(Boolean).join(' ')} {...rest}>
      <span className="v-rating__stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} fill={n <= rounded} />
        ))}
      </span>
      {showValue && <span className="v-rating__count">{value.toFixed(1)}</span>}
      {count != null && <span className="v-rating__count">({count})</span>}
    </span>
  );
}
