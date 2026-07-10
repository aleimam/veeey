import { z } from 'zod';

/**
 * First-party clickstream event vocabulary (FR-BEH-01). Every meaningful
 * interaction is captured and stitched into a per-customer journey via the
 * session id. New event names can be added freely; the pipeline is schemaless
 * on `props`.
 */
export const ANALYTICS_EVENTS = [
  'page_view',
  'page_leave', // carries durationMs = dwell time on the page being left
  'product_view',
  'product_list_view',
  'search',
  'search_no_results',
  'filter_apply',
  'add_to_cart',
  'remove_from_cart',
  'wishlist_add',
  'compare_add',
  'back_in_stock_signup',
  'checkout_start',
  'checkout_step',
  'purchase',
  'cta_click',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type ClientEvent = {
  name: string;
  path?: string;
  props?: Record<string, unknown>;
  durationMs?: number;
  ts?: number;
};

// --- Ingest validation (pure — safe to unit test) --------------------------
const eventSchema = z.object({
  name: z.string().min(1).max(64),
  path: z.string().max(1024).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number().int().min(0).max(21_600_000).optional(), // ≤ 6h sanity cap
  ts: z.number().optional(),
});

const dim = z.number().int().min(0).max(20_000).optional();

export const ingestSchema = z.object({
  sessionId: z.string().min(8).max(64),
  consent: z.enum(['all', 'necessary']).nullish(),
  referrer: z.string().max(1024).optional(),
  utm: z.record(z.string(), z.string()).optional(),
  location: z.string().max(128).optional(),
  language: z.string().max(35).optional(),
  screenW: dim,
  screenH: dim,
  viewportW: dim,
  viewportH: dim,
  events: z.array(eventSchema).min(1).max(50),
});

export type IngestPayload = z.infer<typeof ingestSchema>;
