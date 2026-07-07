import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-guards';
import { canAccessAdmin } from '@/lib/rbac';
import type { FieldChange } from '@/lib/change-log';

/**
 * Change-log queries (owner batch #6). Entries are AuditLog rows — both the
 * automatic field-diff entries written by the prisma extension (`change.*`)
 * and the older hand-written audit actions (`order.placed`, `lot.update`, …)
 * appear in one activity stream.
 */

export type ChangeLogEntry = {
  id: string;
  createdAt: Date;
  action: string;
  actorType: string;
  actorId: string | null;
  actorLabel: string;
  entityType: string | null;
  entityId: string | null;
  changes: FieldChange[] | null;
  snapshot: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
};

export type ChangeLogOpts = {
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
};

function buildWhere(opts: ChangeLogOpts) {
  return {
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
    ...(opts.entityId ? { entityId: opts.entityId } : {}),
    ...(opts.action ? { action: { contains: opts.action, mode: 'insensitive' as const } } : {}),
    ...(opts.from || opts.to
      ? { createdAt: { ...(opts.from ? { gte: new Date(opts.from) } : {}), ...(opts.to ? { lte: new Date(`${opts.to}T23:59:59`) } : {}) } }
      : {}),
  };
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.permissions)) throw new Error('FORBIDDEN');
  return user;
}

function toEntry(row: {
  id: string; createdAt: Date; action: string; actorType: string; actorId: string | null;
  entityType: string | null; entityId: string | null; dataJson: unknown;
}, actorBy: Map<string, string>): ChangeLogEntry {
  const data = (row.dataJson ?? null) as Record<string, unknown> | null;
  const changes = Array.isArray(data?.changes) ? (data!.changes as FieldChange[]) : null;
  const snapshot = data?.snapshot && typeof data.snapshot === 'object' ? (data.snapshot as Record<string, unknown>) : null;
  return {
    id: row.id,
    createdAt: row.createdAt,
    action: row.action,
    actorType: row.actorType,
    actorId: row.actorId,
    actorLabel: row.actorId ? (actorBy.get(row.actorId) ?? row.actorId) : row.actorType,
    entityType: row.entityType,
    entityId: row.entityId,
    changes,
    snapshot,
    meta: changes || snapshot ? null : data,
  };
}

async function actorMap(rows: { actorId: string | null }[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  return new Map(users.map((u) => [u.id, u.name || u.email || u.id]));
}

export async function listChangeLog(opts: ChangeLogOpts = {}) {
  await requireAdmin();
  const where = buildWhere(opts);
  const perPage = opts.perPage ?? 50;
  const page = Math.max(1, opts.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.auditLog.count({ where }),
  ]);
  const actorBy = await actorMap(rows);
  return { entries: rows.map((r) => toEntry(r, actorBy)), total };
}

/** All matching entries (capped) for CSV export — respects the same filters. */
export async function exportChangeLog(opts: ChangeLogOpts = {}, cap = 10000): Promise<ChangeLogEntry[]> {
  await requireAdmin();
  const rows = await prisma.auditLog.findMany({ where: buildWhere(opts), orderBy: { createdAt: 'desc' }, take: cap });
  const actorBy = await actorMap(rows);
  return rows.map((r) => toEntry(r, actorBy));
}

/** One-line human summary of an entry's payload (for CSV / compact views). */
export function entrySummary(e: ChangeLogEntry): string {
  if (e.changes?.length) return e.changes.map((c) => `${c.field}: ${c.from ?? '∅'} → ${c.to ?? '∅'}`).join(' | ');
  if (e.snapshot) return `snapshot: ${JSON.stringify(e.snapshot)}`;
  if (e.meta) return JSON.stringify(e.meta);
  return '';
}

/** Distinct entity types present in the log — for the filter dropdown. */
export async function changeLogEntityTypes(): Promise<string[]> {
  await requireAdmin();
  const rows = await prisma.auditLog.findMany({
    where: { entityType: { not: null } },
    distinct: ['entityType'],
    select: { entityType: true },
    orderBy: { entityType: 'asc' },
  });
  return rows.map((r) => r.entityType!).filter(Boolean);
}

/** Recent history for one entity — the per-record "created / last edited / diffs" panel. */
export async function entityHistory(entityType: string, entityId: string, limit = 25): Promise<ChangeLogEntry[]> {
  await requireAdmin();
  const rows = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const actorBy = await actorMap(rows);
  return rows.map((r) => toEntry(r, actorBy));
}
