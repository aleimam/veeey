/** Pure search-digest rendering (no DB/auth imports — unit-tested). The service
 *  layer (search-digest-service.ts) builds the data and emails it weekly. */

export type SearchDigestData = {
  from: Date;
  to: Date;
  totalSearches: number;
  ctr: number; // 0..1
  zeroRate: number; // 0..1
  soldClicks: number;
  topTerms: { term: string; searches: number }[];
  zeroTerms: { term: string; searches: number }[];
  drivingTerms: { term: string; soldClicks: number }[];
  outOfStock: { name: string; clicks: number }[];
};

const d10 = (d: Date) => d.toISOString().slice(0, 10);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function renderSearchDigest(r: SearchDigestData): { subject: string; body: string } {
  const list = <T>(rows: T[], fmt: (row: T) => string) => (rows.length ? rows.map((x) => `  ${fmt(x)}`) : ['  (none)']);
  const lines: string[] = [
    `Veeey search digest — ${d10(r.from)} to ${d10(r.to)}`,
    '',
    `Searches: ${r.totalSearches}   ·   Click-through: ${pct(r.ctr)}   ·   Zero-result: ${pct(r.zeroRate)}   ·   Clicks that sold: ${r.soldClicks}`,
    '',
    'Top searches:',
    ...list(r.topTerms.slice(0, 10), (t) => `${t.term} — ${t.searches}`),
    '',
    'Zero-result searches (fix these):',
    ...list(r.zeroTerms.slice(0, 10), (t) => `${t.term} — ${t.searches}`),
    '',
    'Purchase-driving searches:',
    ...list(r.drivingTerms.slice(0, 10), (t) => `${t.term} — ${t.soldClicks} sold`),
    '',
    'Clicked but out of stock (restock candidates):',
    ...list(r.outOfStock.slice(0, 10), (p) => `${p.name} — ${p.clicks} clicks`),
    '',
    'Full detail: /admin/analytics/search · fix zero-results at /admin/search-synonyms · restock at /admin/search-demand',
  ];
  return { subject: `Veeey search digest — ${d10(r.to)} (${r.totalSearches} searches)`, body: lines.join('\n') };
}
