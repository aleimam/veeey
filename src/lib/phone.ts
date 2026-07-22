/**
 * Phone helpers (pure — safe in both server and client bundles).
 *
 * Canonical wire format = **digits only, country code first, no `+`** — exactly
 * what `normalizeMobile()` in `@/lib/provider-config` produces (`201012345678`),
 * so SMSMisr dispatch and the existing `User.phone` rows keep matching. Every
 * `<PhoneInput>` submits that shape.
 */

export type DialCountry = {
  /** ISO-3166 alpha-2 (display/key only). */
  iso: string;
  /** Country calling code, digits only, no `+`. */
  dial: string;
  nameEn: string;
  nameAr: string;
  /** National significant number length (digits AFTER the dial code, trunk `0` stripped). */
  min: number;
  max: number;
  /** Example national number, shown as the input placeholder. */
  example: string;
};

/**
 * Curated dial-code list — Egypt first, then the Gulf / Levant / North Africa
 * (where the diaspora customers are), then the common expat destinations. A
 * full ITU dataset is ~200KB of dead weight; anything missing goes through the
 * "Other" free-entry option (`OTHER_DIAL`).
 */
export const DIAL_COUNTRIES: readonly DialCountry[] = [
  { iso: 'EG', dial: '20', nameEn: 'Egypt', nameAr: 'مصر', min: 9, max: 10, example: '1012345678' },
  { iso: 'SA', dial: '966', nameEn: 'Saudi Arabia', nameAr: 'السعودية', min: 8, max: 9, example: '512345678' },
  { iso: 'AE', dial: '971', nameEn: 'United Arab Emirates', nameAr: 'الإمارات', min: 8, max: 9, example: '501234567' },
  { iso: 'KW', dial: '965', nameEn: 'Kuwait', nameAr: 'الكويت', min: 8, max: 8, example: '51234567' },
  { iso: 'QA', dial: '974', nameEn: 'Qatar', nameAr: 'قطر', min: 8, max: 8, example: '33123456' },
  { iso: 'BH', dial: '973', nameEn: 'Bahrain', nameAr: 'البحرين', min: 8, max: 8, example: '36123456' },
  { iso: 'OM', dial: '968', nameEn: 'Oman', nameAr: 'عُمان', min: 8, max: 8, example: '92123456' },
  { iso: 'JO', dial: '962', nameEn: 'Jordan', nameAr: 'الأردن', min: 8, max: 9, example: '791234567' },
  { iso: 'LB', dial: '961', nameEn: 'Lebanon', nameAr: 'لبنان', min: 7, max: 8, example: '71123456' },
  { iso: 'SY', dial: '963', nameEn: 'Syria', nameAr: 'سوريا', min: 8, max: 9, example: '944567890' },
  { iso: 'IQ', dial: '964', nameEn: 'Iraq', nameAr: 'العراق', min: 9, max: 10, example: '7912345678' },
  { iso: 'YE', dial: '967', nameEn: 'Yemen', nameAr: 'اليمن', min: 8, max: 9, example: '712345678' },
  { iso: 'PS', dial: '970', nameEn: 'Palestine', nameAr: 'فلسطين', min: 8, max: 9, example: '599123456' },
  { iso: 'SD', dial: '249', nameEn: 'Sudan', nameAr: 'السودان', min: 9, max: 9, example: '911234567' },
  { iso: 'LY', dial: '218', nameEn: 'Libya', nameAr: 'ليبيا', min: 9, max: 9, example: '912345678' },
  { iso: 'MA', dial: '212', nameEn: 'Morocco', nameAr: 'المغرب', min: 9, max: 9, example: '612345678' },
  { iso: 'DZ', dial: '213', nameEn: 'Algeria', nameAr: 'الجزائر', min: 8, max: 9, example: '551234567' },
  { iso: 'TN', dial: '216', nameEn: 'Tunisia', nameAr: 'تونس', min: 8, max: 8, example: '20123456' },
  { iso: 'TR', dial: '90', nameEn: 'Türkiye', nameAr: 'تركيا', min: 10, max: 10, example: '5321234567' },
  { iso: 'US', dial: '1', nameEn: 'United States / Canada', nameAr: 'الولايات المتحدة / كندا', min: 10, max: 10, example: '4155552671' },
  { iso: 'GB', dial: '44', nameEn: 'United Kingdom', nameAr: 'المملكة المتحدة', min: 9, max: 10, example: '7400123456' },
  { iso: 'DE', dial: '49', nameEn: 'Germany', nameAr: 'ألمانيا', min: 9, max: 11, example: '15112345678' },
  { iso: 'FR', dial: '33', nameEn: 'France', nameAr: 'فرنسا', min: 9, max: 9, example: '612345678' },
  { iso: 'IT', dial: '39', nameEn: 'Italy', nameAr: 'إيطاليا', min: 9, max: 10, example: '3123456789' },
  { iso: 'ES', dial: '34', nameEn: 'Spain', nameAr: 'إسبانيا', min: 9, max: 9, example: '612345678' },
  { iso: 'NL', dial: '31', nameEn: 'Netherlands', nameAr: 'هولندا', min: 9, max: 9, example: '612345678' },
  { iso: 'SE', dial: '46', nameEn: 'Sweden', nameAr: 'السويد', min: 7, max: 9, example: '701234567' },
  { iso: 'CH', dial: '41', nameEn: 'Switzerland', nameAr: 'سويسرا', min: 9, max: 9, example: '781234567' },
  { iso: 'AU', dial: '61', nameEn: 'Australia', nameAr: 'أستراليا', min: 9, max: 9, example: '412345678' },
] as const;

/** Default country for every phone field in the app (Egypt, +20). */
export const DEFAULT_DIAL = '20';
/** Sentinel for the "rest of world" free-entry dial-code option. */
export const OTHER_DIAL = '';
/** Generic national-number bounds used when the dial code is not in the list. */
export const OTHER_MIN = 4;
export const OTHER_MAX = 14;

const digitsOf = (raw: string): string => (raw ?? '').replace(/\D/g, '');
/** Drop the national trunk prefix (`0`) — `01012…` → `1012…`. */
const stripTrunk = (nsn: string): string => nsn.replace(/^0+/, '');

export function dialCountry(dial: string): DialCountry | undefined {
  return DIAL_COUNTRIES.find((c) => c.dial === dial);
}

/** Localized country label for the selector. */
export function dialLabel(c: DialCountry, locale: string): string {
  return `${locale === 'ar' ? c.nameAr : c.nameEn} +${c.dial}`;
}

/** National-number bounds for a dial code (falls back to the generic range). */
export function dialBounds(dial: string): { min: number; max: number } {
  const c = dialCountry(dial);
  return c ? { min: c.min, max: c.max } : { min: OTHER_MIN, max: OTHER_MAX };
}

/**
 * Best-effort split of any stored/typed value into `{ dial, national }` so the
 * picker can be pre-filled. Handles all three shapes we have in the DB:
 * `01012345678` (legacy local), `201012345678` (normalized), `+20 101 234 5678`.
 * `dial === OTHER_DIAL` means "we could not tell" — the UI shows the free-entry
 * country-code box so the user can say.
 */
export function splitPhone(raw: string, fallbackDial: string = DEFAULT_DIAL): { dial: string; national: string } {
  const s = digitsOf(raw);
  if (!s) return { dial: fallbackDial, national: '' };

  // A leading 0 is a national trunk prefix, never a country code.
  if (s.startsWith('0')) return { dial: fallbackDial, national: stripTrunk(s) };

  // Longest matching dial code wins, but only if what remains is a plausible
  // national number for THAT country — otherwise a bare local number like
  // `1012345678` would be read as US (+1) instead of an Egyptian mobile.
  let best: { dial: string; national: string } | null = null;
  for (const c of DIAL_COUNTRIES) {
    if (!s.startsWith(c.dial)) continue;
    const rest = s.slice(c.dial.length);
    if (rest.length < c.min || rest.length > c.max) continue;
    if (!best || c.dial.length > best.dial.length) best = { dial: c.dial, national: rest };
  }
  if (best) return best;

  // No country code in there: short enough to be a bare local number, or an
  // unknown international one the user has to disambiguate.
  const { max } = dialBounds(fallbackDial);
  if (s.length <= max + 1) return { dial: fallbackDial, national: stripTrunk(s) };
  return { dial: OTHER_DIAL, national: s };
}

/**
 * Join a dial code + national number into the canonical wire format. Returns
 * `''` when there is no number, so an optional phone field stays empty.
 */
export function joinPhone(dial: string, national: string): string {
  const n = stripTrunk(digitsOf(national));
  if (!n) return '';
  const d = digitsOf(dial);
  return `${d}${n}`;
}

export type PhoneIssue = 'required' | 'code_required' | 'too_short' | 'too_long';

/**
 * Validate the two halves of the picker. Returns `null` when valid, otherwise
 * a code the UI turns into a precise red message (owner 2026-07-22 #226).
 */
export function checkPhoneParts(dial: string, national: string, required = true): PhoneIssue | null {
  const n = stripTrunk(digitsOf(national));
  if (!n) return required ? 'required' : null;
  const d = digitsOf(dial);
  if (!d) return 'code_required';
  const { min, max } = dialBounds(d);
  if (n.length < min) return 'too_short';
  if (n.length > max) return 'too_long';
  return null;
}

/** Same check against an already-joined value (server-side re-validation). */
export function checkPhoneValue(value: string, required = true): PhoneIssue | null {
  if (!digitsOf(value)) return required ? 'required' : null;
  const { dial, national } = splitPhone(value);
  return checkPhoneParts(dial, national, required);
}

/**
 * Phone validation (pure). Accepts an Egyptian 11-digit number starting with
 * 01, or an international number (E.164-ish, optional +, 7–15 digits). Spaces,
 * dashes and parentheses are ignored.
 */
export function isValidPhone(raw: string): boolean {
  const s = (raw ?? '').replace(/[\s()\-.]/g, '');
  if (/^01\d{9}$/.test(s)) return true; // Egyptian mobile, 11 digits
  if (/^\+?[1-9]\d{6,14}$/.test(s)) return true; // international
  return false;
}

/** HTML input pattern mirroring isValidPhone (client-side hint; server re-checks). */
export const PHONE_PATTERN = '01[0-9]{9}|\\+?[1-9][0-9]{6,14}';
