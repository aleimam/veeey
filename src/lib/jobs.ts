import { PgBoss } from 'pg-boss';

/**
 * Async jobs (FR-NOT, feeds). pg-boss is best-effort: a lazy singleton that
 * connects to Postgres. Callers use `enqueue()` which publishes to the queue if
 * a worker is running, else executes the fallback inline — so every feature works
 * with or without a separate worker process. The dedicated worker (src/worker.ts)
 * registers handlers + schedules recurring jobs.
 */
export const QUEUES = { alerts: 'alerts', notify: 'notify', wooSync: 'woo-sync', auditReport: 'audit-report', auditPurge: 'audit-purge', brandTranslate: 'brand-translate', mediaLocalize: 'media-localize' } as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

let bossPromise: Promise<PgBoss | null> | null = null;

export async function getBoss(): Promise<PgBoss | null> {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.JOBS_DISABLED === '1') return null;
  if (!bossPromise) {
    bossPromise = (async () => {
      try {
        const boss = new PgBoss(url);
        await boss.start();
        return boss;
      } catch {
        return null;
      }
    })();
  }
  return bossPromise;
}

/** Publish to the queue if possible; otherwise run `inline` synchronously. */
export async function enqueue(queue: QueueName, data: object, inline: () => Promise<unknown>): Promise<void> {
  const boss = await getBoss();
  if (boss) {
    try {
      await boss.send(queue, data);
      return;
    } catch {
      // fall through to inline
    }
  }
  await inline();
}
