import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings-service';

/**
 * System error log. Records 404s + runtime/server errors when the admin has
 * enabled it (Setting `errorLog.enabled`, default on). Logging is always
 * best-effort — it must never throw into the caller.
 */
export type ErrorLevel = 'ERROR' | 'WARN' | 'NOT_FOUND';

export async function errorLoggingEnabled(): Promise<boolean> {
  try {
    return (await getSetting('errorLog.enabled')) !== 'false';
  } catch {
    return false;
  }
}

export async function logSystemError(input: { level: ErrorLevel; message: string; source?: string; stack?: string; meta?: Record<string, unknown> }): Promise<void> {
  try {
    if (!(await errorLoggingEnabled())) return;
    await prisma.errorLog.create({
      data: {
        level: input.level,
        message: input.message.slice(0, 2000),
        source: input.source?.slice(0, 300) ?? null,
        stack: input.stack?.slice(0, 6000) ?? null,
        metaJson: input.meta ? (input.meta as object) : undefined,
      },
    });
  } catch {
    // logging must never break the request
  }
}

export function listErrorLogs(take = 100, level?: string) {
  return prisma.errorLog.findMany({ where: level ? { level } : {}, orderBy: { createdAt: 'desc' }, take });
}

export function errorLogCounts() {
  return prisma.errorLog.groupBy({ by: ['level'], _count: true });
}

export async function clearErrorLogs(): Promise<number> {
  const r = await prisma.errorLog.deleteMany({});
  return r.count;
}
