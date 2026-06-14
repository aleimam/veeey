import { getBoss, QUEUES } from '@/lib/jobs';
import { processProductChangeEvents } from '@/lib/alert-service';
import { notify, type NotifyInput } from '@/lib/notification-service';

/**
 * Standalone job worker (run: `npm run worker`). Registers pg-boss handlers and
 * schedules the wishlist-alert sweep. The app itself works without this process
 * (enqueue() falls back to inline) — the worker just moves async work off the
 * request path and adds the recurring sweep.
 */
async function main() {
  const boss = await getBoss();
  if (!boss) {
    console.error('[worker] pg-boss unavailable (set DATABASE_URL, JOBS_DISABLED!=1). Exiting.');
    process.exit(1);
  }

  await boss.work(QUEUES.notify, async ([job]) => {
    await notify(job.data as NotifyInput);
  });

  await boss.work(QUEUES.alerts, async () => {
    const r = await processProductChangeEvents(10);
    console.log(`[worker] alerts swept: ${r.events} events → ${r.sent} notifications`);
  });

  // Recurring wishlist-alert sweep every 5 minutes.
  await boss.schedule(QUEUES.alerts, '*/5 * * * *', {});
  console.log('[worker] started — notify + alerts queues registered, alert sweep scheduled.');
}

void main();
