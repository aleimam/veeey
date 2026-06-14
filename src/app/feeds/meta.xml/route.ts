import { feedProducts, SITE_URL } from '@/lib/feed-service';
import { productFeed } from '@/lib/feed-xml';

// Meta (Facebook/Instagram) catalogs accept the same RSS 2.0 + g: namespace.
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await feedProducts('en');
  const xml = productFeed('Veeey — Meta Catalog', SITE_URL, items);
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
