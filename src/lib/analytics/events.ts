import { z } from 'zod';

/**
 * First-party clickstream event vocabulary (FR-BEH-01). Every meaningful
 * interaction is captured and stitched into a per-customer journey via the
 * session id. New event names can be added freely; the pipeline is schemaless
 * on `props`.
 */
export const ANALYTICS_EVENTS = [
  'page_view',
  'product_view',
  'product_list_view',
  'search',
  'filter_apply',
  'add_to_cart',
  'remove_from_cart',
  'wishlist_add',
  'checkout_step',
  'cta_click',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type ClientEvent = {
  name: string;
  path?: string;
  props?: Record<string, unknown>;
  ts?: number;
};

// --- Ingest validation (pure — safe to unit test) --------------------------
const eventSchema = z.object({
  name: z.string().min(1).max(64),
  path: z.string().max(1024).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  ts: z.number().optional(),
});

export const ingestSchema = z.object({
  sessionId: z.string().min(8).max(64),
  consent: z.enum(['all', 'necessary']).nullish(),
  referrer: z.string().max(1024).optional(),
  utm: z.record(z.string(), z.string()).optional(),
  location: z.string().max(128).optional(),
  events: z.array(eventSchema).min(1).max(50),
});

export type IngestPayload = z.infer<typeof ingestSchema>;
