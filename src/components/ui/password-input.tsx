'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Password field with a show/hide eye toggle (owner 2026-07-22 #226). Used
 * everywhere a customer or staffer types their own password — sign-in,
 * registration, set-password, admin profile, staff form.
 *
 * The toggle is a real <button type="button"> so it never submits the form and
 * is reachable by keyboard; `aria-pressed` announces the current state. Nesting
 * it inside a <label> is safe: browsers do not forward a label click to the
 * labelled control when the click lands on interactive content.
 */

const SHOP_INPUT =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';
const ADMIN_INPUT =
  'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function PasswordInput({
  name,
  required = false,
  minLength,
  autoComplete = 'current-password',
  defaultValue,
  placeholder,
  id,
  variant = 'shop',
  inputClassName,
  className,
  'aria-describedby': describedBy,
}: {
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
  id?: string;
  variant?: 'shop' | 'admin';
  inputClassName?: string;
  className?: string;
  'aria-describedby'?: string;
}) {
  const t = useTranslations('common.password');
  const [show, setShow] = useState(false);
  const base = inputClassName ?? (variant === 'admin' ? ADMIN_INPUT : SHOP_INPUT);

  return (
    // The field's top margin moves to the wrapper so the eye button can centre
    // on the input box itself rather than on box + margin.
    <span className={cn('relative block', variant === 'admin' ? 'mt-1' : 'mt-1.5', className)}>
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-describedby={describedBy}
        className={cn(base, 'mt-0 pe-11')}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t('hide') : t('show')}
        aria-pressed={show}
        title={show ? t('hide') : t('show')}
        className={cn(
          'absolute end-1 top-0 bottom-0 my-auto flex size-9 items-center justify-center rounded-md',
          variant === 'admin'
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-slate-45 hover:text-ink',
        )}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </span>
  );
}
