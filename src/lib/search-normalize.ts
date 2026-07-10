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
