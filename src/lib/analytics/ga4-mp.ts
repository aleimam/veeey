import { gaEvent } from './datalayer';

/**
 * Server-side GA4 via the Measurement Protocol (Analytics P5). Forwards mapped
 * ecommerce events straight to GA4 from our server — ad-blocker-proof and more
 * reliable than the client tag. Runs only when a GA4 Measurement ID + MP API
 * secret are configured AND the visitor gave full consent. Best-effort.
 */
export type MpEvent = { name: string; params: Record<string, unknown> };
const MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

/** Map first-party (name, props) events to GA4 Measurement-Protocol events. Pure. */
export function buildMpEvents(events: Array<{ name: string; props?: Record<string, unknown> }>): MpEvent[] {
  const out: MpEvent[] = [];
  for (const e of events) {
    const g = gaEvent(e.name, e.props ?? {});
    if (g) out.push({ name: g.event, params: g.params });
  }
  return out.slice(0, 25); // MP accepts at most 25 events per request
}

export async function forwardToGa4(opts: {
  measurementId: string;
  apiSecret: string;
  clientId: string;
  events: Array<{ name: string; props?: Record<string, unknown> }>;
  consentAll: boolean;
}): Promise<{ sent: number } | null> {
  const { measurementId, apiSecret, clientId, consentAll } = opts;
  if (!measurementId || !apiSecret || !clientId || !consentAll) return null;
  const mpEvents = buildMpEvents(opts.events);
  if (mpEvents.length === 0) return { sent: 0 };
  const body = {
    client_id: clientId,
    consent: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' },
    events: mpEvents,
  };
  await fetch(`${MP_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  return { sent: mpEvents.length };
}
