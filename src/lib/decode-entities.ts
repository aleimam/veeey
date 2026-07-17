/**
 * Undo the two encodings WordPress leaves in machine-imported catalog data
 * (V7 audit C1/C4). Applied at INGEST (WooCommerce sync, CSV import) — never
 * at manual admin saves, where the text is whatever the admin typed.
 *
 * Production impact when built: 218 products, 6 brands and 14 categories
 * stored `&amp;` inside plain-text names, so React's own escaping showed the
 * literal "&amp;" everywhere; two categories carried percent-encoded Arabic
 * slugs, which never match a lookup because Next hands query params over
 * already decoded.
 */

/** The named entities WP actually emits in titles; numeric forms are handled generically. */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™', deg: '°', micro: 'µ', plusmn: '±', times: '×',
  frac12: '½', frac14: '¼', frac34: '¾',
};

/**
 * Decode HTML entities in a plain-text field. SINGLE pass on purpose: one
 * escape level is one decode, and the production data has no double-escapes
 * (probed 2026-07-17: zero `&amp;amp;` rows) — a loop would turn a name that
 * legitimately talks about "&amp;" into "&".
 */
export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input;
  return input.replace(/&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]{2,10});/g, (match, code: string) => {
    if (code[0] === '#') {
      const cp = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      // Refuse control chars and out-of-range points — keep the literal text.
      return Number.isFinite(cp) && cp >= 0x20 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
    }
    return NAMED[code.toLowerCase()] ?? match; // unknown entity: leave it visible
  });
}

/**
 * Decode a percent-encoded slug (WP encodes non-Latin slugs on the wire).
 * Malformed input is returned untouched — a slug must never throw.
 */
export function decodePercentSlug(slug: string): string {
  if (!slug.includes('%')) return slug;
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
