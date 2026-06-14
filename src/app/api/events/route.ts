import { NextResponse } from 'next/server';
import { ingestEvents } from '@/lib/analytics/ingest-service';

/**
 * Clickstream ingest (FR-BEH-01). Accepts batched events from the browser
 * (fetch or sendBeacon). Best-effort: always 204 so a logging failure never
 * surfaces to the visitor and the browser doesn't retry beacons.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    await ingestEvents(body);
  } catch {
    // swallow — analytics must never break the page
  }
  return new NextResponse(null, { status: 204 });
}
