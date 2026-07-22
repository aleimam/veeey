import 'dotenv/config';
import { prisma } from '@/lib/prisma';

/**
 * Clear veeey.net's catalog / customer / order data before reloading it from
 * egyptvitamins.net. Configuration is NOT touched — export it first with
 * `scripts/config/export.ts` regardless, so the reload has a replay to fall back on.
 *
 *   npx tsx scripts/wipe-test-data.ts             # DRY RUN — counts only
 *   npx tsx scripts/wipe-test-data.ts --commit
 *
 * 🔴 THE TRAP THIS AVOIDS. `User` holds shoppers AND staff: 16,241 rows, of
 * which 16,229 have a Customer and 13 are in a department — and those sets
 * OVERLAP by one, a colleague who also shops here. Deleting "users with a
 * customer record" would therefore delete a staff account, and deleting all
 * users would lock everyone out of the admin entirely. So a user is only
 * removed when they have a Customer **and belong to no department**.
 *
 * Everything here is rebuilt by the catalog + customer sync. AuditLog is
 * included on the owner's explicit instruction (2026-07-22); it is the one item
 * in this list that cannot be reconstructed from anywhere.
 */
const WIPE_ORDER = [
  // Orders and everything hanging off them.
  'orderGift', 'giftMovement', 'orderStatusHistory', 'orderItem', 'returnItem', 'return',
  'loyaltyTransaction', 'couponRedemption', 'referral', 'specialOrder', 'order',
  // Inventory movement, then the lots themselves.
  'lotReservation', 'movementLedger', 'spillageEntry', 'stocktakeCount', 'stocktakeSession',
  'incomingShipmentPhoto', 'incomingShipmentLot', 'incomingShipment',
  'netStockOutbox', 'wpStockIngest', 'purchaseRequest', 'reorderIgnore',
  'requestPhoto', 'requestLine', 'request', 'refillRun', 'refillPlan', 'lot',
  // Catalog.
  'productAttributeValue', 'productRelation', 'productChangeEvent', 'reviewMedia', 'review',
  'productQuestion', 'productImage', 'product', 'variantGroup', 'attributeValue',
  'tag', 'brand', 'category',
  // Shopper-owned records, then the shoppers (handled separately below).
  'wishlistItem', 'wishlistList', 'compareItem', 'compareList', 'cartSnapshot',
  'notificationPreference', 'pushSubscription', 'notification', 'otpCode', 'address',
  // Telemetry + queues.
  'analyticsEvent', 'analyticsSession', 'searchClick', 'searchQuery',
  'errorLog', 'outboxEvent', 'auditLog',
] as const;

/** Kept: configuration, staff, and anything the sync cannot rebuild. */
const PROTECTED = [
  'setting', 'orderStatusConfig', 'systemPaymentMethod', 'department', 'departmentMember',
  'role', 'permission', 'tier', 'tierBenefit', 'shippingZone', 'shippingArea', 'shippingTypeConfig',
  'returnReason', 'spillageReason', 'notificationTemplate', 'socialLink', 'homeTestimonial',
  'homeTrustBadge', 'redirect', 'giftRule', 'gift', 'searchRule', 'searchSynonym',
  'location', 'theme', 'pageLayout', 'cmsPage', 'blogPost', 'collection', 'attribute',
  'quiz', 'game', 'integrationClient', 'backupConfig', 'backupTier',
] as const;

async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`\n=== veeey.net test-data wipe — ${commit ? 'COMMIT' : 'DRY RUN (no deletes)'} ===\n`);

  const c = prisma as unknown as Record<string, { count?: (a?: unknown) => Promise<number>; deleteMany?: (a?: unknown) => Promise<{ count: number }> }>;

  // Shoppers = has a Customer and sits in no department. The overlap is real, so
  // this is computed, never assumed.
  const shopperWhere = {
    customer: { isNot: null },
    departments: { none: {} },
  };
  const shoppers = await (prisma as unknown as { user: { count: (a: unknown) => Promise<number> } }).user.count({ where: shopperWhere });
  const staff = await (prisma as unknown as { user: { count: (a: unknown) => Promise<number> } }).user.count({ where: { departments: { some: {} } } });

  let total = 0;
  for (const m of WIPE_ORDER) {
    const n = (await c[m]?.count?.()) ?? -1;
    if (n > 0) { console.log(`  ${m.padEnd(26)} ${String(n).padStart(8)}`); total += n; }
    else if (n < 0) console.log(`  ${m.padEnd(26)} — model not found, skipped`);
  }
  console.log(`  ${'user (shoppers)'.padEnd(26)} ${String(shoppers).padStart(8)}   (cascades to Customer)`);
  total += shoppers;
  console.log(`\n  would delete ${total} row(s)`);
  console.log(`\n  🔒 KEPT: ${staff} staff user(s) + configuration across ${PROTECTED.length} tables`);
  let kept = 0;
  for (const m of PROTECTED) kept += (await c[m]?.count?.()) ?? 0;
  console.log(`     ${kept} configuration row(s) preserved`);

  if (!commit) { console.log('\nℹ️ DRY RUN — nothing deleted. Re-run with --commit.\n'); await prisma.$disconnect(); return; }

  console.log('\n  deleting…');
  for (const m of WIPE_ORDER) {
    const r = await c[m]?.deleteMany?.();
    if (r?.count) console.log(`    ${m.padEnd(26)} ${String(r.count).padStart(8)} deleted`);
  }
  const u = await (prisma as unknown as { user: { deleteMany: (a: unknown) => Promise<{ count: number }> } }).user.deleteMany({ where: shopperWhere });
  console.log(`    ${'user (shoppers)'.padEnd(26)} ${String(u.count).padStart(8)} deleted`);
  console.log('\n✅ done. Re-run the catalog + customer sync, then replay the config export if needed.\n');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
