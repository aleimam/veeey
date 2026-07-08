import { prisma } from '@/lib/prisma';
import { getSetting, getNumberSetting } from '@/lib/settings-service';
import { dispatchEmail } from '@/lib/notification-dispatch';
import { renderAuditReport, type AuditReport } from '@/lib/audit-report';

/**
 * Scheduled audit/change-log reports + retention. The worker runs two crons:
 *  - weekly: email a summary of admin activity (AuditLog — the same rows the
 *    /admin/change-log page shows) to staff, gated by `audit.weeklyReport`.
 *  - daily: purge entries older than `audit.retentionDays` (0 = keep forever).
 * All knobs are admin-configurable Settings with seeded defaults; the pure
 * report shape + text rendering live in audit-report.ts (unit-tested).
 */

export async function buildAuditReport(days = 7): Promise<AuditReport> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const where = { createdAt: { gte: from, lte: to } };

  const [total, byEntityRaw, byActionRaw, byActorRaw] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ['entityType'], where, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ['action'], where, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ['actorId'], where: { ...where, actorId: { not: null } }, _count: { _all: true } }),
  ]);

  const byEntity = byEntityRaw
    .map((r) => ({ entity: r.entityType ?? '(other)', count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const topActions = byActionRaw
    .map((r) => ({ action: r.action, count: r._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const actorRows = byActorRaw
    .map((r) => ({ actorId: r.actorId!, count: r._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const users = actorRows.length
    ? await prisma.user.findMany({ where: { id: { in: actorRows.map((a) => a.actorId) } }, select: { id: true, name: true, email: true } })
    : [];
  const nameBy = new Map(users.map((u) => [u.id, u.name || u.email || u.id]));
  const topActors = actorRows.map((a) => ({ actor: nameBy.get(a.actorId) ?? a.actorId, count: a.count }));

  return { from, to, total, byEntity, topActions, topActors };
}

/** Weekly report job. Recipients: `audit.reportRecipients` (comma-separated) or every staff user with a role. */
export async function sendWeeklyAuditReport(): Promise<{ sent: number; skipped?: string }> {
  if ((await getSetting('audit.weeklyReport')).trim().toLowerCase() !== 'on') return { sent: 0, skipped: 'disabled' };

  const configured = (await getSetting('audit.reportRecipients'))
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
  const recipients = configured.length
    ? configured
    : (await prisma.user.findMany({ where: { AND: [{ email: { not: null } }, { OR: [{ departments: { some: {} } }, { roleId: { not: null } }] }] }, select: { email: true } }))
        .map((u) => u.email!)
        .filter(Boolean);
  if (!recipients.length) return { sent: 0, skipped: 'no recipients' };

  const { subject, body } = renderAuditReport(await buildAuditReport(7));
  let sent = 0;
  for (const to of recipients) {
    const r = await dispatchEmail(to, subject, body);
    if (r.ok) sent += 1;
  }
  return { sent };
}

/** Daily retention purge. `audit.retentionDays` 0 (or empty) = keep forever. */
export async function purgeOldAuditLogs(): Promise<{ deleted: number; skipped?: string }> {
  const days = await getNumberSetting('audit.retentionDays');
  if (!Number.isFinite(days) || days <= 0) return { deleted: 0, skipped: 'retention off' };
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const r = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: r.count };
}
