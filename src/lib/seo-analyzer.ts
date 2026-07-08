/**
 * RankMath-style SEO analyzer — pure (no DB/React), shared by the product-form
 * live panel (client) and the catalog SEO health report (server). Produces a
 * 0–100 score from weighted checks, each pass/warn/fail. Works for EN and AR
 * (Arabic-aware normalization; no stemming — exact normalized substring match).
 */

export type SeoCheckStatus = 'pass' | 'warn' | 'fail';
export type SeoCheck = { id: string; status: SeoCheckStatus; detail: string; weight: number };
export type SeoResult = { score: number; grade: 'good' | 'ok' | 'poor'; checks: SeoCheck[] };

export type SeoInput = {
  keyword: string; // primary focus keyword ('' = not set)
  title: string; // SEO title (fallback: product name)
  metaDesc: string;
  slug: string;
  contentHtml: string; // long description (raw HTML)
  imageAlts?: string[]; // gallery alt texts (content <img alt> is also scanned)
  siteHost?: string; // internal-link detection (default veeey.com)
};

// --- text utilities ---------------------------------------------------------

/** Lowercase + Arabic normalization (strip tashkeel, unify alef/yaa forms). */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '') // tatweel
    .trim();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (s: string): string[] => normalizeText(s).match(/[\p{L}\p{N}]+/gu) ?? [];

const includesKw = (haystack: string, kw: string): boolean =>
  normalizeText(haystack).includes(normalizeText(kw));

/** Slug match: keyword words joined by hyphens (or all words present). */
function slugHasKeyword(slug: string, kw: string): boolean {
  const kwWords = words(kw);
  if (!kwWords.length) return false;
  // A malformed escape (bare '%' from migrated slugs) makes decodeURIComponent
  // throw — fall back to the raw slug rather than crash the editor/report.
  let decoded = slug;
  try { decoded = decodeURIComponent(slug); } catch { /* keep raw */ }
  const slugNorm = normalizeText(decoded).replace(/[-_]/g, ' ');
  return kwWords.every((w) => slugNorm.includes(w));
}

function firstParagraph(html: string): string {
  const m = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (m) {
    const text = htmlToText(m[1]);
    if (text) return text;
  }
  return htmlToText(html).slice(0, 400);
}

function subheadings(html: string): string[] {
  const out: string[] = [];
  const re = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(htmlToText(m[2]));
  return out;
}

function contentImageAlts(html: string): string[] {
  const out: string[] = [];
  const re = /<img\b[^>]*\balt\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[2] ?? m[3] ?? '');
  return out;
}

function linkHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[2] ?? m[3] ?? '');
  return out;
}

// --- Google snippet pixel estimation ----------------------------------------

/** Rough per-char pixel widths at Google's title font (~20px Arial). */
function charPx(ch: string): number {
  if (/[ilj.,'|!:;\[\]()]/.test(ch)) return 5;
  if (/[mwMW@]/.test(ch)) return 17;
  if (/[A-Z]/.test(ch)) return 13;
  if (/[؀-ۿ]/.test(ch)) return 9; // Arabic average
  if (ch === ' ') return 6;
  return 10;
}

/** Estimated rendered width of an SERP title (Google truncates ≈ 580px). */
export const titlePixels = (s: string): number => Math.round([...s].reduce((n, c) => n + charPx(c), 0));
/** Meta description renders ~30% smaller (limit ≈ 920px desktop / 680px mobile). */
export const descPixels = (s: string): number => Math.round(titlePixels(s) * 0.7);

export const TITLE_PX_LIMIT = 580;
export const DESC_PX_LIMIT = 920;
export const DESC_PX_LIMIT_MOBILE = 680;

// --- analyzer ----------------------------------------------------------------

const pct = (n: number, of: number) => (of === 0 ? 0 : (n / of) * 100);

export function analyzeSeo(input: SeoInput): SeoResult {
  const kw = input.keyword.trim();
  const html = input.contentHtml || '';
  const text = htmlToText(html);
  const wordList = words(text);
  const checks: SeoCheck[] = [];
  const add = (id: string, weight: number, status: SeoCheckStatus, detail: string) =>
    checks.push({ id, weight, status, detail });

  const kwSet = kw !== '';
  const kwFail = (id: string, weight: number, where: string) =>
    add(id, weight, 'fail', kwSet ? `Focus keyword not found in ${where}` : 'Set a focus keyword first');

  // Keyword placement (54 pts)
  if (kwSet && includesKw(input.title, kw)) add('kw_title', 12, 'pass', 'Focus keyword appears in the SEO title');
  else kwFail('kw_title', 12, 'the SEO title');

  if (kwSet && includesKw(input.metaDesc, kw)) add('kw_meta', 10, 'pass', 'Focus keyword appears in the meta description');
  else kwFail('kw_meta', 10, 'the meta description');

  if (kwSet && slugHasKeyword(input.slug, kw)) add('kw_slug', 8, 'pass', 'Focus keyword appears in the URL slug');
  else kwFail('kw_slug', 8, 'the URL slug');

  if (kwSet && includesKw(firstParagraph(html), kw)) add('kw_first_para', 10, 'pass', 'Focus keyword appears in the first paragraph');
  else kwFail('kw_first_para', 10, 'the first paragraph');

  const heads = subheadings(html);
  if (kwSet && heads.some((h) => includesKw(h, kw))) add('kw_subheading', 8, 'pass', 'Focus keyword appears in a subheading (H1–H3)');
  else if (kwSet && heads.length === 0) add('kw_subheading', 8, 'warn', 'No subheadings (H2/H3) in the description');
  else kwFail('kw_subheading', 8, 'any subheading');

  const alts = [...(input.imageAlts ?? []), ...contentImageAlts(html)].filter(Boolean);
  if (kwSet && alts.some((a) => includesKw(a, kw))) add('kw_alt', 6, 'pass', 'Focus keyword appears in image alt text');
  else if (alts.length === 0) add('kw_alt', 6, 'warn', 'No image alt texts found');
  else kwFail('kw_alt', 6, 'image alt text');

  // Lengths (20 pts)
  const tLen = input.title.trim().length;
  const tPx = titlePixels(input.title);
  if (tLen >= 30 && tLen <= 60 && tPx <= TITLE_PX_LIMIT) add('title_len', 10, 'pass', `Title length is good (${tLen} chars, ~${tPx}px)`);
  else if (tLen === 0) add('title_len', 10, 'fail', 'SEO title is empty');
  else if (tLen < 30) add('title_len', 10, 'warn', `Title is short (${tLen} chars — aim for 30–60)`);
  else add('title_len', 10, tPx > TITLE_PX_LIMIT ? 'fail' : 'warn', `Title is long (${tLen} chars, ~${tPx}px — Google truncates ≈ ${TITLE_PX_LIMIT}px)`);

  const dLen = input.metaDesc.trim().length;
  const dPx = descPixels(input.metaDesc);
  if (dLen >= 120 && dLen <= 160 && dPx <= DESC_PX_LIMIT) add('meta_len', 10, 'pass', `Meta description length is good (${dLen} chars)`);
  else if (dLen === 0) add('meta_len', 10, 'fail', 'Meta description is empty');
  else if (dLen < 120) add('meta_len', 10, 'warn', `Meta description is short (${dLen} chars — aim for 120–160)`);
  else add('meta_len', 10, dPx > DESC_PX_LIMIT ? 'fail' : 'warn', `Meta description is long (${dLen} chars — may be truncated)`);

  // Keyword density (8 pts)
  if (kwSet && wordList.length > 0) {
    const kwWords = words(kw);
    let hits = 0;
    if (kwWords.length > 0) {
      for (let i = 0; i + kwWords.length <= wordList.length; i++) {
        if (kwWords.every((w, j) => wordList[i + j] === w)) hits++;
      }
    }
    const density = pct(hits * Math.max(1, kwWords.length), wordList.length);
    if (hits === 0) add('density', 8, 'fail', 'Focus keyword does not appear in the description');
    else if (density >= 0.5 && density <= 2.5) add('density', 8, 'pass', `Keyword density is good (${density.toFixed(1)}%, ${hits}×)`);
    else if (density < 0.5) add('density', 8, 'warn', `Keyword density is low (${density.toFixed(1)}%)`);
    else if (density <= 4) add('density', 8, 'warn', `Keyword density is high (${density.toFixed(1)}%)`);
    else add('density', 8, 'fail', `Keyword stuffing (${density.toFixed(1)}%)`);
  } else {
    add('density', 8, 'fail', kwSet ? 'Description is empty' : 'Set a focus keyword first');
  }

  // Content length (8 pts)
  if (wordList.length >= 300) add('content_len', 8, 'pass', `Description length is good (${wordList.length} words)`);
  else if (wordList.length >= 150) add('content_len', 8, 'warn', `Description is short (${wordList.length} words — aim for 300+)`);
  else add('content_len', 8, 'fail', `Description is very short (${wordList.length} words)`);

  // Links (5 pts)
  const hrefs = linkHrefs(html);
  const host = (input.siteHost ?? 'veeey.com').toLowerCase();
  const internal = hrefs.some((h) => h.startsWith('/') || h.toLowerCase().includes(host));
  const external = hrefs.some((h) => /^https?:\/\//i.test(h) && !h.toLowerCase().includes(host));
  if (internal && external) add('links', 5, 'pass', 'Has internal and external links');
  else if (internal || external) add('links', 5, 'warn', internal ? 'Has internal links; consider an authoritative external link' : 'Has external links; consider linking related Veeey pages');
  else add('links', 5, 'warn', 'No links in the description');

  // Readability (5 pts) — average sentence length proxy.
  const sentences = text.split(/[.!?؟…]+/).map((s) => s.trim()).filter((s) => words(s).length > 0);
  const avg = sentences.length ? wordList.length / sentences.length : wordList.length;
  if (wordList.length === 0) add('readability', 5, 'fail', 'No content to read');
  else if (avg <= 20) add('readability', 5, 'pass', `Readable — ~${Math.round(avg)} words per sentence`);
  else if (avg <= 28) add('readability', 5, 'warn', `Sentences are long (~${Math.round(avg)} words) — break them up`);
  else add('readability', 5, 'fail', `Very long sentences (~${Math.round(avg)} words average)`);

  const score = Math.round(checks.reduce((n, c) => n + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight / 2 : 0), 0));
  return { score, grade: score >= 80 ? 'good' : score >= 50 ? 'ok' : 'poor', checks };
}
