/**
 * SMSMisr message encoding (pure, unit-tested). Language 1/2 accepts plain
 * GSM/ASCII text; language 3 (Unicode — Arabic, em dashes, emoji) requires the
 * message as UCS-2 HEX: each UTF-16 code unit as 4 uppercase hex digits,
 * concatenated — raw UTF-8 text is rejected with code 1909.
 */

/** True when the text needs SMSMisr's Unicode encoding (language 3). */
export const needsUnicodeSms = (text: string) => [...text].some((ch) => {
  const c = ch.codePointAt(0)!;
  return (c < 0x20 && ch !== '\n' && ch !== '\r') || c > 0x7e;
});

/** UTF-16BE code units as concatenated 4-digit uppercase hex (UCS-2 HEX). */
export function toUcs2Hex(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return out;
}
