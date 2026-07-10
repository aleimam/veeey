import { NextResponse } from 'next/server';
import { ingestEvents } from '@/lib/analytics/ingest-service';
import { clientIp } from '@/lib/analytics/enrich';

/**
 * Clickstream ingest (FR-BEH-01). Accepts batched events from the browser
 * (fetch or sendBeacon). Best-effort: always 204 so a logging failure never
 * surfaces to the visitor and the browser doesn't retry beacons. IP / UA /
 * language are read from request headers here (never trusted from the body).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const h = req.headers;
    await ingestEvents(body, {
      ip: clientIp(h.get('x-forwarded-for'), h.get('x-real-ip')),
      userAgent: h.get('user-agent'),
      acceptLanguage: h.get('accept-language'),
    });
  } catch {
    // swallow — analytics must never break the page
  }
  return new NextResponse(null, { status: 204 });
}
