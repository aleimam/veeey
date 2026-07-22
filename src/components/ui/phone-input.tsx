'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  DIAL_COUNTRIES,
  OTHER_DIAL,
  checkPhoneParts,
  dialBounds,
  dialCountry,
  dialLabel,
  joinPhone,
  splitPhone,
  type PhoneIssue,
} from '@/lib/phone';

/**
 * The one phone entry control for the whole app (owner 2026-07-22 #226):
 * country-code selector + national number, defaulting to Egypt (+20), with a
 * precise red message when the number doesn't fit the chosen country.
 *
 * What reaches the server is a single hidden field named `name`, in the
 * canonical wire format (`joinPhone` → `201012345678`), so every existing
 * server action keeps working unchanged. Server actions re-validate with
 * `checkPhoneValue` — this control is a convenience, never the gate.
 *
 * Keyboard/AT: native <select> + <input>, each with its own aria-label, and the
 * error is wired through aria-describedby. The control row is forced LTR
 * because a country code precedes the number in Arabic too.
 */

// Both design languages, so a caller only has to say which one it is in.
const SHOP_INPUT =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';
const ADMIN_INPUT =
  'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export type PhoneInputProps = {
  /** Form field name — the hidden, normalized value is submitted under this. */
  name: string;
  /** Controlled value (canonical or legacy format). Omit for uncontrolled use. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** `form` attribute — for controls that live outside their <form> (table rows). */
  form?: string;
  variant?: 'shop' | 'admin';
  /** Overrides the variant's input classes when a call site needs a custom width. */
  inputClassName?: string;
  className?: string;
  /** Error supplied by the parent's own validation — wins over the internal one. */
  error?: string;
  id?: string;
  autoComplete?: string;
  /** Stack the country selector above the number (narrow columns). */
  stacked?: boolean;
};

export function PhoneInput({
  name,
  value,
  defaultValue,
  onChange,
  required = false,
  disabled = false,
  form,
  variant = 'shop',
  inputClassName,
  className,
  error,
  id,
  autoComplete = 'tel',
  stacked = false,
}: PhoneInputProps) {
  const t = useTranslations('common.phone');
  const locale = useLocale();
  const autoId = useId();
  const fieldId = id ?? `phone-${autoId}`;

  const [initial] = useState(() => splitPhone(value ?? defaultValue ?? ''));
  const [dial, setDial] = useState(initial.dial);
  const [national, setNational] = useState(initial.national);
  const [touched, setTouched] = useState(false);
  // What we last handed the parent — lets us tell "the parent echoed our own
  // value back" (ignore) from "the parent reset the field" (re-derive).
  const emitted = useRef(joinPhone(initial.dial, initial.national));

  useEffect(() => {
    if (value === undefined || value === emitted.current) return;
    const next = splitPhone(value);
    emitted.current = value;
    setDial(next.dial);
    setNational(next.national);
  }, [value]);

  const push = (nextDial: string, nextNational: string) => {
    setDial(nextDial);
    setNational(nextNational);
    const joined = joinPhone(nextDial, nextNational);
    emitted.current = joined;
    onChange?.(joined);
  };

  const issue: PhoneIssue | null = checkPhoneParts(dial, national, required);
  const country = dialCountry(dial);
  const bounds = dialBounds(dial);
  const countryName = country ? (locale === 'ar' ? country.nameAr : country.nameEn) : t('otherCountry');
  const isOther = !country;

  const internalMsg =
    !touched || !issue
      ? null
      : issue === 'required'
        ? t('errRequired')
        : issue === 'code_required'
          ? t('errCodeRequired')
          : issue === 'too_short'
            ? t('errTooShort', { country: countryName, min: bounds.min })
            : t('errTooLong', { country: countryName, max: bounds.max });
  const msg = error ?? internalMsg;

  const base = inputClassName ?? (variant === 'admin' ? ADMIN_INPUT : SHOP_INPUT);
  const invalid = msg ? 'border-[1.5px] border-[color:var(--error)]' : '';
  const errCls = variant === 'admin' ? 'text-destructive' : 'text-error';
  const errId = `${fieldId}-err`;

  return (
    <span className={cn('block', className)}>
      <span dir="ltr" className={cn('flex gap-2', stacked ? 'flex-col' : 'flex-row')}>
        <select
          value={isOther ? OTHER_DIAL : dial}
          onChange={(e) => push(e.target.value, national)}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          aria-label={t('countryLabel')}
          className={cn(base, !stacked && 'w-auto max-w-[10rem] shrink-0', invalid)}
        >
          {DIAL_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.dial}>{dialLabel(c, locale)}</option>
          ))}
          <option value={OTHER_DIAL}>{t('other')}</option>
        </select>

        {isOther && (
          <input
            type="text"
            inputMode="numeric"
            value={dial}
            onChange={(e) => push(e.target.value.replace(/\D/g, '').slice(0, 4), national)}
            onBlur={() => setTouched(true)}
            disabled={disabled}
            aria-label={t('codeLabel')}
            placeholder={t('codePlaceholder')}
            className={cn(base, 'w-20 shrink-0', invalid)}
          />
        )}

        <input
          id={fieldId}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          value={national}
          onChange={(e) => push(dial, e.target.value.replace(/[^\d\s()+.-]/g, ''))}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          required={required}
          aria-label={t('numberLabel')}
          aria-invalid={msg ? true : undefined}
          aria-describedby={msg ? errId : undefined}
          placeholder={country?.example ?? t('numberPlaceholder')}
          className={cn(base, 'min-w-0 flex-1', invalid)}
        />
      </span>

      {/* The canonical, normalized value — this is what the server reads. */}
      <input type="hidden" name={name} form={form} value={joinPhone(dial, national)} />

      {msg && (
        <span id={errId} role="alert" className={cn('mt-1 block text-xs font-normal', errCls)}>
          {msg}
        </span>
      )}
    </span>
  );
}
