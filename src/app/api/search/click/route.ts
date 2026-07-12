import { logSearchClick } from '@/lib/search-service';
import { readCartId } from '@/lib/cart-service';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/** Record a search-result click (instant dropdown or results page). Best-effort,
 *  rate-limited, no auth. Body: { term, slug?, position?, source? }. */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`searchclick:${await clientIp()}`, 120, 10 * 60_000)) return new Response(null, { status: 204 });
    const body = (await req.json().catch(() => ({}))) as { term?: string; slug?: string; position?: number; source?: string };
    if (body.term) {
      const sessionId = await readCartId();
      await logSearchClick({ term: body.term, slug: body.slug ?? null, position: body.position ?? 0, source: body.source === 'instant' ? 'instant' : 'results', sessionId });
    }
  } catch {
    // best-effort
  }
  return new Response(null, { status: 204 });
}
