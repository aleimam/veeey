import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { ingestSchema } from './events';
import { parseUserAgent, truncateIp, primaryLanguage } from './enrich';
import { lookupGeo } from './geoip';

/** Request-derived metadata the browser can't be trusted to send (extracted from
 *  headers in the route handler). */
export type RequestMeta = { ip: string | null; userAgent: string | null; acceptLanguage: string | null };
const NO_META: RequestMeta = { ip: null, userAgent: null, acceptLanguage: null };

/** Scalar-only enrichment fields — assignable to both the create and update inputs. */
type EnrichFields = {
  deviceType: string;
  isBot: boolean;
  os: string | null;
  browser: string | null;
  ip?: string | null;
  ipTruncated?: string | null;
  userAgent?: string | null;
  osVersion?: string | null;
  browserVersion?: string | null;
  language?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  screenW?: number;
  screenH?: number;
  viewportW?: number;
  viewportH?: number;
};

/**
 * Server-side ingest (FR-BEH-01/02) with visitor enrichment (Analytics P1).
 *
 * Consent tiers:
 *  - Always: coarse, non-identifying classifiers (deviceType, isBot, OS/browser
 *    family) so aggregate stats + bot filtering work for everyone.
 *  - Full consent ('all') only: raw IP + anonymized IP, city/region/country,
 *    full UA + versions, language, screen/viewport, and the customer link.
 * Best-effort by design — a logging failure never surfaces to the visitor.
 */
export async function ingestEvents(raw: unknown, meta: RequestMeta = NO_META): Promise<void> {
  const data = ingestSchema.parse(raw);
  const fullConsent = data.consent === 'all';

  let customerId: string | null = null;
  if (fullConsent) {
    const session = await auth();
    customerId = session?.user?.customerId ?? null;
  }

  // Landing/exit path from this batch's page events.
  const pagePaths = data.events
    .filter((e) => e.name === 'page_view' || e.name === 'page_leave')
    .map((e) => e.path)
    .filter((p): p is string => !!p);
  const firstPath = pagePaths[0];
  const lastPath = pagePaths[pagePaths.length - 1];

  const dev = parseUserAgent(meta.userAgent);
  // Coarse, non-PII classifiers — captured regardless of consent. Precise /
  // identifying fields are layered on only under full consent.
  const enrich: EnrichFields = {
    deviceType: dev.deviceType,
    isBot: dev.isBot,
    os: dev.os,
    browser: dev.browser,
  };
  if (fullConsent) {
    const geo = await lookupGeo(meta.ip);
    Object.assign(enrich, {
      ip: meta.ip,
      ipTruncated: truncateIp(meta.ip),
      userAgent: meta.userAgent?.slice(0, 1024) ?? null,
      osVersion: dev.osVersion,
      browserVersion: dev.browserVersion,
      language: data.language ?? primaryLanguage(meta.acceptLanguage),
      country: geo.country,
      region: geo.region,
      city: geo.city,
      screenW: data.screenW,
      screenH: data.screenH,
      viewportW: data.viewportW,
      viewportH: data.viewportH,
    } satisfies Partial<EnrichFields>);
  }
  const now = new Date();

  await prisma.analyticsSession.upsert({
    where: { sessionId: data.sessionId },
    update: {
      ...(customerId ? { customerId } : {}),
      ...enrich,
      lastSeenAt: now,
      ...(lastPath ? { exitPath: lastPath } : {}),
    },
    create: {
      sessionId: data.sessionId,
      customerId,
      referrer: data.referrer,
      location: data.location,
      utmJson: (data.utm ?? undefined) as Prisma.InputJsonValue | undefined,
      landingPath: firstPath,
      exitPath: lastPath,
      lastSeenAt: now,
      ...enrich,
    },
  });

  await prisma.analyticsEvent.createMany({
    data: data.events.map((e) => ({
      sessionId: data.sessionId,
      customerId,
      type: e.name,
      path: e.path,
      durationMs: e.durationMs ?? null,
      propsJson: (e.props ?? undefined) as Prisma.InputJsonValue | undefined,
    })),
  });
}
