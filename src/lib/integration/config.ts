/**
 * YeldnIN integration config (INTEGRATION_CONTRACT). Everything is gated by
 * INTEGRATION_ENABLED (default OFF — routes 404, no outbound emission). Develop
 * against the local mock receiver (scripts/mock-veeey-receiver.mjs).
 *
 * ⚠️ The specific endpoint payloads/business rules below trace to a CONTRACT
 * SNAPSHOT and must be re-baselined against the latest YeldnIN description before
 * the flag is turned on in staging.
 */
export const integrationEnabled = () => ['1', 'true', 'yes'].includes((process.env.INTEGRATION_ENABLED ?? '').toLowerCase());
export const integrationSecret = () => process.env.INTEGRATION_CLIENT_VEEEY_SECRET ?? '';
export const yeldninBaseUrl = () => process.env.YELDNIN_BASE_URL ?? 'http://localhost:4500/api/integration/v1';

export const VEEEY_CLIENT_ID = 'veeey';
export const YELDNIN_CLIENT_ID = 'yeldnin';

/** Retry backoff per contract §5: 1m → 5m → 30m → 2h → 12h, then DEAD. */
export const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];

/** Outbox event type → YeldnIN endpoint path (contract §4). */
export const OUTBOX_PATHS: Record<string, string> = {
  'products.upsert': '/products/upsert',
  'requests.create': '/requests', // legacy single-line (flat PurchaseRequest) — superseded
  'requests.upsert': '/requests', // Requests epic D: multi-line, uid-keyed upsert
  'revenue.event': '/revenue-events',
  'deliveries.create': '/deliveries',
};
