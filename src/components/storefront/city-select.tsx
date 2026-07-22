'use client';

import type { CitiesByGovernorate } from '@/lib/city-service';

/**
 * City as a dropdown nested under the chosen governorate (owner 2026-07-23).
 *
 * The whole list ships with the page (~400 rows) and is filtered here, so
 * changing governorate re-populates instantly instead of putting a spinner in
 * the middle of typing an address.
 *
 * FREE TEXT REMAINS POSSIBLE. 7,398 saved addresses hold 1,070 distinct city
 * strings, and some of them are real places this list does not name — a compound,
 * a village, a new development. Forcing the dropdown would make those customers
 * unable to enter their own address, so an unrecognised value is kept and shown
 * as a selected option rather than silently dropped, and "Other" reopens the
 * text field.
 */
export function CitySelect({
  value,
  governorate,
  cities,
  locale,
  onChange,
  label,
  otherLabel,
  chooseLabel,
  pickGovernorateFirstLabel,
  className,
  error,
  onBlur,
}: {
  value: string;
  governorate: string;
  cities: CitiesByGovernorate;
  locale: string;
  onChange: (v: string) => void;
  label: string;
  otherLabel: string;
  chooseLabel: string;
  pickGovernorateFirstLabel: string;
  className: string;
  error?: React.ReactNode;
  onBlur?: () => void;
}) {
  const options = governorate ? (cities[governorate] ?? []) : [];
  const nameOf = (c: { nameEn: string; nameAr: string }) => (locale === 'ar' ? c.nameAr : c.nameEn);
  const known = options.some((c) => nameOf(c) === value || c.nameEn === value);
  // A value we don't recognise is a real address someone already has. Keep it
  // selectable rather than resetting the field the moment they open the page.
  const custom = !!value && !known;

  return (
    <div>
      <label className="block text-sm font-semibold text-ink" htmlFor="city">{label}</label>
      <select
        id="city"
        // `name` lives on the select so the chosen district posts with the form;
        // the free-text input below takes over the name when "Other" is active.
        name={custom ? undefined : 'city'}
        value={custom ? '__other__' : value}
        disabled={!governorate}
        onChange={(e) => onChange(e.target.value === '__other__' ? ' ' : e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        className={className}
      >
        <option value="" disabled>{governorate ? chooseLabel : pickGovernorateFirstLabel}</option>
        {options.map((c) => (
          <option key={c.code} value={nameOf(c)}>{nameOf(c)}</option>
        ))}
        <option value="__other__">{otherLabel}</option>
      </select>

      {custom && (
        <input
          name="city"
          value={value.trim() === '' ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={otherLabel}
          aria-label={otherLabel}
          aria-invalid={error ? true : undefined}
          className={className}
        />
      )}
      {error}
    </div>
  );
}
