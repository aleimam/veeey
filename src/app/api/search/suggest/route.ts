import type { NextRequest } from 'next/server';
import { suggestSearch } from '@/lib/search-service';

/** Search autocomplete (FR-SCH-02; audit P1 5.2). Public, read-only, lean
 *  payload; briefly CDN-cacheable so keystrokes don't hammer the DB. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 60);
  const locale = req.nextUrl.searchParams.get('locale') === 'ar' ? 'ar' : 'en';
  try {
    const data = await suggestSearch(q, locale);
    return Response.json(data, {
      headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch {
    return Response.json({ products: [], brands: [], categories: [], posts: [], popular: [] });
  }
}
