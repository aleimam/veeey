import type { InputHTMLAttributes, ReactNode } from 'react';

/** Veeey Radio — circular pill motif with a lime dot on select. */
export function Radio({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={['v-check', 'v-check--radio', className].filter(Boolean).join(' ')}>
      <input type="radio" {...rest} />
      <span className="v-check__box" aria-hidden="true">
        <span className="v-check__dot" />
      </span>
      {label && <span className="v-check__label">{label}</span>}
    </label>
  );
}
