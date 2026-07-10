import { prisma } from '@/lib/prisma';
import { getNumberSetting } from '@/lib/settings-service';
import { audit } from '@/lib/audit';

/**
 * Analytics data retention (Analytics P1). Raw clickstream isn't kept forever —
 * a daily worker cron purges events + sessions older than `analytics.retentionDays`
 * (0 = keep forever). Also exposes a per-customer erase for deletion requests.
 */
const DEFAULT_RETENTION_DAYS = 90;

export async function purgeOldAnalytics(): Promise<{ skipped?: string; events: number; sessions: number }> {
  const days = (await getNumberSetting('analytics.retentionDays')) || DEFAULT_RETENTION_DAYS;
  if (!days || days <= 0) return { skipped: 'retention disabled (0 days)', events: 0, sessions: 0 };
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Events first, then their (now event-free) sessions — the optional relation
  // nulls any straggler references, so this order never trips the FK.
  const events = await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  const sessions = await prisma.analyticsSession.deleteMany({ where: { startedAt: { lt: cutoff } } });
  await audit({
    actorType: 'SYSTEM',
    action: 'analytics.retention.purge',
    entityType: 'AnalyticsEvent',
    entityId: `${events.count} events / ${sessions.count} sessions`,
    data: { days, events: events.count, sessions: sessions.count },
  });
  return { events: events.count, sessions: sessions.count };
}

/** Erase a customer's analytics footprint (deletion request / account removal). */
export async function deleteCustomerAnalytics(customerId: string): Promise<{ events: number; sessions: number }> {
  const events = await prisma.analyticsEvent.deleteMany({ where: { customerId } });
  const sessions = await prisma.analyticsSession.deleteMany({ where: { customerId } });
  return { events: events.count, sessions: sessions.count };
}
