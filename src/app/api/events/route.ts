import { NextResponse, after } from 'next/server';
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

    // Server-side GA4 (P5): forward ecommerce events to the Measurement Protocol
    // AFTER the response (never blocks the beacon), only under full consent and
    // when GA4 MP is configured. Un-consented traffic skips the config read.
    if (body?.consent === 'all' && Array.isArray(body?.events)) {
      after(async () => {
        try {
          const [{ getGoogleConfig }, { forwardToGa4 }] = await Promise.all([
            import('@/lib/google-service'),
            import('@/lib/analytics/ga4-mp'),
          ]);
          const cfg = await getGoogleConfig();
          if (cfg.ga4Id && cfg.ga4ApiSecret) {
            await forwardToGa4({
              measurementId: cfg.ga4Id,
              apiSecret: cfg.ga4ApiSecret,
              clientId: String(body.sessionId ?? ''),
              events: body.events,
              consentAll: true,
            });
          }
        } catch {
          // best-effort — GA4 forwarding must never affect the visitor
        }
      });
    }
  } catch {
    // swallow — analytics must never break the page
  }
  return new NextResponse(null, { status: 204 });
}
