import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  error?: boolean;
  required?: boolean;
}

/** Veeey Input — labelled text field, surface fill, lime focus, error/hint. */
export function Input({ label, hint, error = false, required = false, id, className = '', ...rest }: InputProps) {
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
      <input id={fieldId} className="v-input" aria-invalid={error || undefined} {...rest} />
      {hint && <span className="v-field__hint">{hint}</span>}
    </div>
  );
}
