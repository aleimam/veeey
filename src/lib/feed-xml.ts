/**
 * Product feed XML (FR-FEED-01/02). Builds RSS 2.0 + Google `g:` namespace items,
 * the format accepted by both Google Merchant Center and Meta (Facebook/Instagram)
 * catalogs. Pure + unit-tested.
 */
export function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export type FeedProduct = {
  sku: string;
  gtin?: string | null;
  title: string;
  description: string;
  link: string;
  imageLink?: string | null;
  pricePiastres: number;
  brand?: string | null;
  inStock: boolean;
};

const egp = (piastres: number) => `${(piastres / 100).toFixed(2)} EGP`;

export function googleItem(p: FeedProduct): string {
  const parts = [
    `<g:id>${xmlEscape(p.sku)}</g:id>`,
    `<g:title>${xmlEscape(p.title)}</g:title>`,
    `<g:description>${xmlEscape(p.description)}</g:description>`,
    `<g:link>${xmlEscape(p.link)}</g:link>`,
    p.imageLink ? `<g:image_link>${xmlEscape(p.imageLink)}</g:image_link>` : '',
    `<g:availability>${p.inStock ? 'in_stock' : 'out_of_stock'}</g:availability>`,
    `<g:price>${egp(p.pricePiastres)}</g:price>`,
    p.brand ? `<g:brand>${xmlEscape(p.brand)}</g:brand>` : '',
    p.gtin ? `<g:gtin>${xmlEscape(p.gtin)}</g:gtin>` : '<g:identifier_exists>no</g:identifier_exists>',
    '<g:condition>new</g:condition>',
  ].filter(Boolean);
  return `<item>${parts.join('')}</item>`;
}

export function productFeed(title: string, link: string, items: FeedProduct[]): string {
  const body = items.map(googleItem).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${xmlEscape(title)}</title><link>${xmlEscape(link)}</link><description>${xmlEscape(title)} product feed</description>${body}</channel></rss>`;
}
