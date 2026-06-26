import 'dotenv/config'; // tsx doesn't auto-load .env (Next does) — load it for the standalone worker
import { getBoss, QUEUES } from '@/lib/jobs';
import { processProductChangeEvents } from '@/lib/alert-service';
import { notify, type NotifyInput } from '@/lib/notification-service';
import { runScheduledSync, syncEntity, runFullSync } from '@/lib/migration/wc-sync';

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

  // pg-boss v12 requires a queue to exist before work/send/schedule. createQueue
  // is idempotent — safe to call on every boot.
  await boss.createQueue(QUEUES.notify);
  await boss.createQueue(QUEUES.alerts);
  await boss.createQueue(QUEUES.wooSync);

  await boss.work(QUEUES.notify, async ([job]) => {
    await notify(job.data as NotifyInput);
  });

  await boss.work(QUEUES.alerts, async () => {
    const r = await processProductChangeEvents(10);
    console.log(`[worker] alerts swept: ${r.events} events → ${r.sent} notifications`);
  });

  // WooCommerce live sync — scheduled run is gated by woo.sync.enabled; a webhook
  // job carries {entity} and syncs that entity regardless (it's its own opt-in).
  await boss.work(QUEUES.wooSync, async ([job]) => {
    const d = job?.data as { entity?: 'products' | 'customers' | 'orders'; full?: boolean } | undefined;
    if (d?.full) {
      // Manual "Sync everything": drain a ~10-min chunk, then re-enqueue self until done.
      const { summaries, done } = await runFullSync({ budgetMs: 600_000 });
      console.log(`[worker] woo full sync chunk: ${summaries.map((r) => `${r.entity}(+${r.created}/~${r.updated})`).join(', ')} — ${done ? 'COMPLETE' : 'continuing…'}`);
      if (!done) await boss.send(QUEUES.wooSync, { full: true });
    } else if (d?.entity) {
      const r = await syncEntity(d.entity, { maxPages: 1 });
      console.log(`[worker] woo webhook sync ${r.entity}: +${r.created}/~${r.updated}`);
    } else {
      const runs = await runScheduledSync(20);
      if (runs.length) console.log(`[worker] woo sync: ${runs.map((r) => `${r.entity}(+${r.created}/~${r.updated})`).join(', ')}`);
    }
  });

  // Recurring wishlist-alert sweep every 5 minutes.
  await boss.schedule(QUEUES.alerts, '*/5 * * * *', {});
  // WooCommerce incremental sync every 15 minutes (gated by woo.sync.enabled).
  await boss.schedule(QUEUES.wooSync, '*/15 * * * *', {});
  console.log('[worker] started — notify + alerts + woo-sync queues registered, schedules set.');
}

void main();
