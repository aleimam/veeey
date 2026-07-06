/**
 * FAQ structure parser (audit P2 6.2). Splits a (sanitized) CMS rich body into
 * topic groups (h2) of question/answer items (h3 + following content) so the
 * page can render a scannable, searchable accordion instead of a wall of text.
 * Pure string work — unit-testable; a body without h3 questions yields no
 * items and the caller falls back to plain rendering.
 */

export type FaqItem = { q: string; a: string };
export type FaqTopic = { title: string; items: FaqItem[] };
export type ParsedFaq = { intro: string; topics: FaqTopic[]; count: number };

const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function splitItems(chunk: string): { lead: string; items: FaqItem[] } {
  const parts = chunk.split(/<h3[^>]*>/i);
  const lead = parts.shift() ?? '';
  const items: FaqItem[] = [];
  for (const part of parts) {
    const close = part.search(/<\/h3>/i);
    if (close === -1) continue;
    const q = strip(part.slice(0, close));
    const a = part.slice(close + 5).trim();
    if (q) items.push({ q, a });
  }
  return { lead: lead.trim(), items };
}

export function parseFaq(html: string | null | undefined): ParsedFaq {
  if (!html) return { intro: '', topics: [], count: 0 };
  const sections = html.split(/<h2[^>]*>/i);
  const head = sections.shift() ?? '';
  const topics: FaqTopic[] = [];
  let intro = '';

  // Content before the first h2 can itself carry h3 questions (untitled topic).
  const headParsed = splitItems(head);
  intro = headParsed.lead;
  if (headParsed.items.length) topics.push({ title: '', items: headParsed.items });

  for (const section of sections) {
    const close = section.search(/<\/h2>/i);
    if (close === -1) continue;
    const title = strip(section.slice(0, close));
    const { lead, items } = splitItems(section.slice(close + 5));
    // A topic's lead text (between h2 and first h3) folds into the intro flow only if it has no items.
    if (items.length) topics.push({ title, items });
    else if (lead && strip(lead)) topics.push({ title, items: [{ q: title, a: lead }] });
  }

  const count = topics.reduce((s, t) => s + t.items.length, 0);
  return { intro, topics, count };
}

/** Plain-text haystack for the client-side FAQ search. */
export function faqSearchText(item: FaqItem): string {
  return `${item.q} ${strip(item.a)}`.toLowerCase();
}
