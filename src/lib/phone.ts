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
