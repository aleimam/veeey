/**
 * YeldnIN integration config (INTEGRATION_CONTRACT). Everything is gated by
 * INTEGRATION_ENABLED (default OFF — routes 404, no outbound emission). Develop
 * against the local mock receiver (scripts/mock-veeey-receiver.mjs).
 *
 * ⚠️ The specific endpoint payloads/business rules below trace to a CONTRACT
 * SNAPSHOT and must be re-baselined against the latest YeldnIN description before
 * the flag is turned on in staging.
 */
export const integrationSecret = () => process.env.INTEGRATION_CLIENT_VEEEY_SECRET ?? '';
export const yeldninBaseUrl = () => process.env.YELDNIN_BASE_URL ?? 'http://localhost:4500/api/integration/v1';

/** DB Setting key for the admin on/off toggle (the "disable from backend" switch). */
export const INTEGRATION_TOGGLE_KEY = 'integration.enabled';

/**
 * Live on/off for the YeldnIN link. Backend-controllable (Requests epic D):
 * ON requires the shared secret to be configured (env, set at deploy) AND the
 * admin toggle flipped on (DB Setting) — so the owner enables/disables it from
 * `/admin/integration` without an env change. `INTEGRATION_ENABLED=0/false` in
 * the env is a hard kill switch that overrides the toggle. The secret-first
 * check keeps this cheap (no DB read) whenever no secret is configured = the
 * default disabled posture.
 */
export async function integrationEnabled(): Promise<boolean> {
  const env = (process.env.INTEGRATION_ENABLED ?? '').toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(env)) return false; // explicit kill switch
  if (!integrationSecret()) return false; // no secret → never on
  const { getSetting } = await import('@/lib/settings-service');
  return (await getSetting(INTEGRATION_TOGGLE_KEY)) === 'true';
}

export const VEEEY_CLIENT_ID = 'veeey';
export const YELDNIN_CLIENT_ID = 'yeldnin';

/** Retry backoff per contract §5: 1m → 5m → 30m → 2h → 12h, then DEAD. */
export const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];

/** Outbox event type → YeldnIN endpoint path (contract §4). */
export const OUTBOX_PATHS: Record<string, string> = {
  'products.upsert': '/products/upsert', // legacy SKU-keyed push — superseded by catalog.upsert
  'catalog.upsert': '/catalog', // Catalog sync channel: wpId-keyed product upsert (contract §4.2)
  'requests.create': '/requests', // legacy single-line (flat PurchaseRequest) — superseded
  'requests.upsert': '/requests', // Requests epic D: multi-line, uid-keyed upsert
  'revenue.event': '/revenue-events',
  'deliveries.create': '/deliveries',
};
