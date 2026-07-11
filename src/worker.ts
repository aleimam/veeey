import 'dotenv/config'; // tsx doesn't auto-load .env (Next does) — load it for the standalone worker
import { getBoss, QUEUES } from '@/lib/jobs';
import { processProductChangeEvents } from '@/lib/alert-service';
import { notify, type NotifyInput } from '@/lib/notification-service';
import { runScheduledSync, syncEntity, runFullSync } from '@/lib/migration/wc-sync';
import { sendWeeklyAuditReport, purgeOldAuditLogs } from '@/lib/audit-report-service';

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
  await boss.createQueue(QUEUES.auditReport);
  await boss.createQueue(QUEUES.auditPurge);
  await boss.createQueue(QUEUES.brandTranslate);
  await boss.createQueue(QUEUES.mediaLocalize);
  await boss.createQueue(QUEUES.analyticsPurge);
  await boss.createQueue(QUEUES.reviewRequest);
  await boss.createQueue(QUEUES.abandonedCart);
  await boss.createQueue(QUEUES.lotExpiry);
  await boss.createQueue(QUEUES.loyaltyStanding);
  await boss.createQueue(QUEUES.stocktakeCycle);

  await boss.work(QUEUES.notify, async ([job]) => {
    await notify(job.data as NotifyInput);
  });

  await boss.work(QUEUES.reviewRequest, async ([job]) => {
    const { sendReviewRequest } = await import('@/lib/review-request-service');
    const orderId = (job.data as { orderId: string }).orderId;
    const r = await sendReviewRequest(orderId);
    console.log(`[worker] review-request ${orderId}: ${r.sent ? 'sent' : r.reason}`);
  });

  await boss.work(QUEUES.abandonedCart, async () => {
    const { sweepAbandonedCarts } = await import('@/lib/abandoned-cart-service');
    const r = await sweepAbandonedCarts();
    console.log(`[worker] abandoned-cart sweep: ${r.sent} reminder(s) sent`);
  });

  await boss.work(QUEUES.alerts, async () => {
    const r = await processProductChangeEvents(); // consumes pending events exactly-once
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

  // Audit/change-log maintenance: weekly staff report + daily retention purge
  // (both gated by admin Settings — audit.weeklyReport / audit.retentionDays).
  await boss.work(QUEUES.auditReport, async () => {
    const r = await sendWeeklyAuditReport();
    console.log(`[worker] audit report: ${r.skipped ? `skipped (${r.skipped})` : `sent to ${r.sent} recipient(s)`}`);
  });
  await boss.work(QUEUES.auditPurge, async () => {
    const r = await purgeOldAuditLogs();
    console.log(`[worker] audit purge: ${r.skipped ? `skipped (${r.skipped})` : `${r.deleted} old entries deleted`}`);
  });

  // Bulk brand Arabic-name translation (started from /admin/brands).
  await boss.work(QUEUES.brandTranslate, async () => {
    const { runBrandNameTranslation } = await import('@/lib/taxonomy-service');
    const r = await runBrandNameTranslation();
    console.log(`[worker] brand translate: ${r.state} — ${r.done}/${r.total} translated, ${r.failed} failed`);
  });

  // Catalog media localization (old-CDN images → local /uploads; from /admin/go-live).
  await boss.work(QUEUES.mediaLocalize, async () => {
    const { runMediaLocalization } = await import('@/lib/media-localize-service');
    const r = await runMediaLocalization();
    console.log(`[worker] media localize: ${r.state} — ${r.done}/${r.total} localized, ${r.failed} dead (${r.deleted} image rows pruned)`);
  });

  // Analytics data-retention purge (events + sessions past analytics.retentionDays).
  await boss.work(QUEUES.analyticsPurge, async () => {
    const { purgeOldAnalytics } = await import('@/lib/analytics/retention-service');
    const r = await purgeOldAnalytics();
    console.log(`[worker] analytics purge: ${r.skipped ? `skipped (${r.skipped})` : `${r.events} events / ${r.sessions} sessions deleted`}`);
  });

  // Auto-expire overdue lots (V4 C6) — LIVE lots past expiry → EXPIRED.
  await boss.work(QUEUES.lotExpiry, async () => {
    const { expireOverdueLots } = await import('@/lib/inventory-service');
    const r = await expireOverdueLots();
    console.log(`[worker] lot expiry sweep: ${r.expired} lot(s) auto-expired`);
  });

  // Loyalty standing recompute (V5 F29) — lifetime spend + tier from DELIVERED
  // orders; catches WooCommerce-synced orders that never pass transitionOrder.
  await boss.work(QUEUES.loyaltyStanding, async () => {
    const { recomputeLoyaltyStanding } = await import('@/lib/loyalty-service');
    const r = await recomputeLoyaltyStanding();
    console.log(`[worker] loyalty standing: ${r.updated}/${r.scanned} customer(s) updated`);
  });

  // Cycle-count schedules (V4 D21) — open due stocktake sessions.
  await boss.work(QUEUES.stocktakeCycle, async () => {
    const { runDueStocktakeSchedules } = await import('@/lib/stocktake-service');
    const r = await runDueStocktakeSchedules();
    console.log(`[worker] stocktake schedules: ${r.opened} session(s) opened`);
  });

  // Recurring wishlist-alert sweep every 5 minutes.
  await boss.schedule(QUEUES.alerts, '*/5 * * * *', {});
  // WooCommerce incremental sync every 15 minutes (gated by woo.sync.enabled).
  await boss.schedule(QUEUES.wooSync, '*/15 * * * *', {});
  // Weekly activity report Mondays 06:00 UTC; retention purge daily 04:30 UTC.
  await boss.schedule(QUEUES.auditReport, '0 6 * * 1', {});
  await boss.schedule(QUEUES.auditPurge, '30 4 * * *', {});
  // Analytics retention purge daily 04:45 UTC.
  await boss.schedule(QUEUES.analyticsPurge, '45 4 * * *', {});
  // Abandoned-cart reminder sweep hourly at :15 (gated by cart.abandonedReminderEnabled).
  await boss.schedule(QUEUES.abandonedCart, '15 * * * *', {});
  // Auto-expire overdue lots daily 03:10 UTC; loyalty standing recompute 03:25 UTC.
  await boss.schedule(QUEUES.lotExpiry, '10 3 * * *', {});
  await boss.schedule(QUEUES.loyaltyStanding, '25 3 * * *', {});
  // Open due cycle-count sessions daily 02:45 UTC (before the workday).
  await boss.schedule(QUEUES.stocktakeCycle, '45 2 * * *', {});
  console.log('[worker] started — notify + alerts + woo-sync + audit queues registered, schedules set.');
}

void main();
