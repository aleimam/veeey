import { prisma } from '@/lib/prisma';

/**
 * Audit-log writer (AGENTS.md §Security; FR-MCP-04). Every privileged write —
 * human or AI — should leave a trail. Best-effort: a logging failure must never
 * break the action it records.
 */
type AuditEntry = {
  actorType?: 'USER' | 'CUSTOMER' | 'AI' | 'SYSTEM';
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  data?: unknown;
  ip?: string | null;
};

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: entry.actorType ?? 'SYSTEM',
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        dataJson: entry.data === undefined ? undefined : (entry.data as object),
        ip: entry.ip ?? null,
      },
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
}
