/**
 * Pure query normalizer for search rules (#186). Kept in its own module (no
 * prisma / auth imports) so tests can import it without dragging next-auth in.
 * Lowercases, strips Arabic tashkeel, folds alef/yaa/taa-marbuta variants, and
 * collapses whitespace — so a rule saved for "vit d" also catches "Vit-D".
 */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[ً-ْ]/g, '') // tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Template placeholders hitting the literal sitelinks-search URL (V5 audit F7).
 * The WebSite JSON-LD SearchAction advertises `…/search?q={search_term_string}`;
 * crawlers sometimes request that URL verbatim, which used to be logged as a
 * real search and topped every report. Blocklisted at INGEST (never logged) —
 * the search itself still runs so the visitor gets a normal empty result page.
 */
export function isPlaceholderTerm(raw: string): boolean {
  const s = raw.toLowerCase();
  return (
    s.includes('{') ||
    s.includes('}') ||
    s.includes('%7b') || // URL-encoded '{'
    s.includes('%7d') ||
    s.includes('search_term_string')
  );
}
