import type { InputHTMLAttributes, ReactNode } from 'react';

/** Veeey Checkbox — rounded-square pill motif with a lime check. */
export function Checkbox({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={['v-check', 'v-check--checkbox', className].filter(Boolean).join(' ')}>
      <input type="checkbox" {...rest} />
      <span className="v-check__box" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#D1D725" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {label && <span className="v-check__label">{label}</span>}
    </label>
  );
}
