import type { InputHTMLAttributes, ReactNode } from 'react';

/** Veeey Switch — pill toggle, dark green when on. */
export function Switch({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={['v-switch', className].filter(Boolean).join(' ')}>
      <input type="checkbox" role="switch" {...rest} />
      <span className="v-switch__track" aria-hidden="true">
        <span className="v-switch__thumb" />
      </span>
      {label && <span className="v-switch__label">{label}</span>}
    </label>
  );
}
