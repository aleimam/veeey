import type { ReactNode, SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: ReactNode;
  error?: boolean;
  required?: boolean;
  children?: ReactNode;
}

/** Veeey Select — native dropdown styled to the input system, RTL-aware chevron. */
export function Select({ label, hint, error = false, required = false, id, children, className = '', ...rest }: SelectProps) {
  const fieldId = id || (label ? `v-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className={['v-field', error ? 'v-field--error' : '', className].filter(Boolean).join(' ')}>
      {label && (
        <label className="v-field__label" htmlFor={fieldId}>
          {label}
          {required && (
            <span className="v-field__req" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <select id={fieldId} className="v-select" aria-invalid={error || undefined} {...rest}>
        {children}
      </select>
      {hint && <span className="v-field__hint">{hint}</span>}
    </div>
  );
}
