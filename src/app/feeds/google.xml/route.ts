import { feedProducts, SITE_URL } from '@/lib/feed-service';
import { productFeed } from '@/lib/feed-xml';

// Generated on demand (large, DB-backed); CDN-cached for an hour via headers.
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await feedProducts('en');
  const xml = productFeed('Veeey — Google Merchant', SITE_URL, items);
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
