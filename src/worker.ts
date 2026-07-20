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
  await boss.createQueue(QUEUES.gscSitemap);
  await boss.createQueue(QUEUES.watermark);
  await boss.createQueue(QUEUES.loyaltyBackfill);
  await boss.createQueue(QUEUES.searchDigest);
  await boss.createQueue(QUEUES.attributeAutofill);
  await boss.createQueue(QUEUES.refillSweep);
  await boss.createQueue(QUEUES.integrationV2Sweep);
  await boss.createQueue(QUEUES.optionalRefill);
  await boss.createQueue(QUEUES.integrationDispatch);
  await boss.createQueue(QUEUES.backupSweep);

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

  // Daily sitemap (re)submit to Google Search Console (no-op until connected).
  await boss.work(QUEUES.gscSitemap, async () => {
    const { gscConnected, submitSitemap } = await import('@/lib/gsc-service');
    if (!(await gscConnected())) return;
    const r = await submitSitemap();
    console.log(`[worker] GSC sitemap submit: ${r.ok ? 'ok' : r.error}`);
  });

  // Product-photo watermark batch (stamp / remove) — reversible, originals kept.
  await boss.work(QUEUES.watermark, async ([job]) => {
    const { runWatermark } = await import('@/lib/watermark-service');
    const r = await runWatermark(job.data as Parameters<typeof runWatermark>[0]);
    console.log(`[worker] watermark ${(job.data as { action?: string }).action}: ${r.done} done, ${r.failed} failed of ${r.total}`);
  });

  // Global retroactive loyalty-points backfill (owner-triggered).
  await boss.work(QUEUES.loyaltyBackfill, async () => {
    const { backfillAllOrderPoints } = await import('@/lib/loyalty-service');
    const r = await backfillAllOrderPoints();
    console.log(`[worker] loyalty backfill: ${r.points} pts across ${r.orders} orders / ${r.customers} customers`);
  });

  // Veeey Refill autoship sweep: advance-notice SMS + place due COD orders.
  // No-ops while the Refill feature toggle is OFF.
  await boss.work(QUEUES.refillSweep, async () => {
    const { sweepRefills } = await import('@/lib/refill-service');
    const r = await sweepRefills();
    console.log(`[worker] refill sweep: ${r.skippedReason ?? `${r.notified} notified, ${r.ordered} ordered, ${r.skipped} skipped, ${r.errors} error(s)`}`);
  });

  // Contract v2 §5 safety net: nightly full re-push of products + registered
  // customers to YeldnIN. No-op unless integration.v2.enabled is armed.
  await boss.work(QUEUES.backupSweep, async () => {
    const { runDueBackups } = await import('@/lib/backup/backup-service');
    const r = await runDueBackups();
    if (r.ran) console.log('[worker] backup: ' + r.results.map((x) => x.tier + '=' + x.status).join(' '));
  });

  await boss.work(QUEUES.integrationV2Sweep, async () => {
    const { sweepV2 } = await import('@/lib/integration/product-customer-sync');
    const r = await sweepV2();
    if (r.products || r.customers) console.log(`[worker] v2 sweep queued: ${r.products} products, ${r.customers} customers`);
  });

  // Always-Needed → monthly OPTIONAL purchasing-request refill (Requests epic C).
  // No-ops when no products are marked Always-Needed.
  await boss.work(QUEUES.optionalRefill, async () => {
    const { runOptionalRefill } = await import('@/lib/request-service');
    const r = await runOptionalRefill();
    console.log(`[worker] optional refill: ${r.created} created, ${r.reset} reset, ${r.refreshed} refreshed`);
  });

  // Drain the YeldnIN outbox (Requests epic D) — signs + POSTs due request events.
  // Returns {skipped:true} (no-op) while INTEGRATION_ENABLED is off.
  await boss.work(QUEUES.integrationDispatch, async () => {
    const { dispatchOutbox } = await import('@/lib/integration/integration-service');
    // Drain in batches until the outbox is empty (cap 40k events/tick) so a
    // nightly v2 full sweep (~18k for a 2.5k-product / 16k-customer store)
    // clears the same tick instead of backlogging forever at 20/tick.
    let sent = 0, failed = 0;
    for (let round = 0; round < 200; round++) {
      const r = await dispatchOutbox(200);
      if (r.skipped) break;
      sent += r.sent; failed += r.failed;
      if (r.sent + r.failed === 0) break; // outbox drained (or only future-scheduled retries remain)
    }
    if (sent || failed) console.log(`[worker] integration dispatch: ${sent} sent, ${failed} failed`);
  });

  // One-click AI auto-fill of all filterable product attributes (only-missing,
  // never overwrites) — started from /admin/attributes/bulk.
  await boss.work(QUEUES.attributeAutofill, async () => {
    const { runAttributeAutofill } = await import('@/lib/attribute-bulk-service');
    const r = await runAttributeAutofill();
    console.log(`[worker] attribute autofill: ${r.state} — ${r.applied} applied, ${r.skipped} skipped, ${r.scanned} scanned across ${r.attrTotal} attribute(s)`);
  });

  // Weekly search digest (top / zero-result / demand) — gated by search.weeklyDigest.
  await boss.work(QUEUES.searchDigest, async () => {
    const { sendWeeklySearchDigest } = await import('@/lib/search-digest-service');
    const r = await sendWeeklySearchDigest();
    console.log(`[worker] search digest: ${r.skipped ? `skipped (${r.skipped})` : `sent to ${r.sent} recipient(s)`}`);
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
  // Re-submit the sitemap to Google Search Console daily 05:15 UTC (no-op if not connected).
  await boss.schedule(QUEUES.gscSitemap, '15 5 * * *', {});
  // Weekly search digest Mondays 06:30 UTC (gated by search.weeklyDigest).
  await boss.schedule(QUEUES.searchDigest, '30 6 * * 1', {});
  // Refill autoship sweep daily 07:00 UTC (≈09:00 Cairo — orders land in the workday).
  await boss.schedule(QUEUES.refillSweep, '0 7 * * *', {});
  // Always-Needed optional refill — daily 03:50 UTC; the service only resets a
  // product's request once its cycle is ≥30 days old, so a daily tick is cheap.
  await boss.schedule(QUEUES.optionalRefill, '50 3 * * *', {});
  // YeldnIN outbox drain every 2 min (Requests epic D) — no-op while disabled.
  await boss.schedule(QUEUES.integrationDispatch, '*/2 * * * *', {});
  // Contract v2 nightly full re-push (products + customers) 02:30 UTC — no-op until armed.
  await boss.schedule(QUEUES.integrationV2Sweep, '30 2 * * *', {});
  // Off-site backup tick every 10 min. The tick only ASKS — each level carries
  // its own cadence (BACKUP.md) and the app decides which are due. No-op until
  // backups are enabled and configured.
  await boss.schedule(QUEUES.backupSweep, '*/10 * * * *', {});
  console.log('[worker] started — notify + alerts + woo-sync + audit queues registered, schedules set.');
}

void main();
