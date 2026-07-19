import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/**
 * Admin-configurable business constants (AGENTS.md rule #2 — never hard-code
 * tiers/discounts/SLAs/rates). A typed registry with seeded defaults backs a
 * key/value Setting table; consumers read via getNumberSetting/getSetting and
 * fall back to the default when unset. Gated by `settings.manage`, audited.
 */
export type SettingType = 'number' | 'percent' | 'days' | 'text';
export type SettingDef = { key: string; label: string; group: string; type: SettingType; default: string; hint?: string };

export const SETTINGS: SettingDef[] = [
  // Loyalty
  { key: 'loyalty.redeemPointsPerEgp', label: 'Points to redeem 1 EGP', group: 'Loyalty', type: 'number', default: '200', hint: 'How many points equal 1 EGP at checkout.' },
  { key: 'loyalty.pointsExpiryDays', label: 'Points expiry (days)', group: 'Loyalty', type: 'days', default: '0', hint: '0 = points never expire.' },
  { key: 'loyalty.tierWindowDays', label: 'Tier qualification window (days)', group: 'Loyalty', type: 'days', default: '0', hint: '0 = lifetime spend decides the tier; 365 = only spend in the last 365 days counts toward tier promotion/demotion.' },
  { key: 'loyalty.selectMembershipEgp', label: 'SELECT membership price (EGP / year)', group: 'Loyalty', type: 'number', default: '12000', hint: 'Annual paid-membership price for the SELECT tier. Grant it on the customer page: Tier = SELECT + Lock tier + Until = one year out.' },
  // Special orders
  { key: 'specialOrder.depositPercent', label: 'Special-order deposit (%)', group: 'Special orders', type: 'percent', default: '25', hint: 'Deposit required to reserve a special order.' },
  { key: 'specialOrder.defaultLeadDays', label: 'Default lead time (days)', group: 'Special orders', type: 'days', default: '20' },
  { key: 'specialOrder.compensationGraceDays', label: 'Compensation grace (days)', group: 'Special orders', type: 'days', default: '3', hint: 'Days past the promised date before auto-compensation applies.' },
  // Pre-orders (buy a product before it is back in stock)
  { key: 'preorder.depositPercent', label: 'Pre-order deposit (%)', group: 'Pre-orders', type: 'percent', default: '25', hint: 'Deposit charged up front to reserve a pre-order; the balance is due on delivery.' },
  // Catalog
  { key: 'catalog.lowStockThreshold', label: 'Product low-stock threshold', group: 'Catalog', type: 'number', default: '5', hint: 'Products with sellable stock at or below this count match the "Low stock" filter.' },
  // Gifts
  { key: 'gifts.lowStockThreshold', label: 'Gift low-stock threshold', group: 'Gifts', type: 'number', default: '5', hint: 'Gifts at or below this stock show a low-stock warning in the gifts list.' },
  // Audit / activity log
  { key: 'audit.weeklyReport', label: 'Weekly activity report', group: 'Audit log', type: 'text', default: 'on', hint: 'on / off — email staff a weekly summary of admin activity (the change log).' },
  { key: 'audit.reportRecipients', label: 'Report recipients', group: 'Audit log', type: 'text', default: '', hint: 'Comma-separated emails. Empty = every staff user with a role.' },
  { key: 'audit.retentionDays', label: 'Change-log retention (days)', group: 'Audit log', type: 'days', default: '365', hint: '0 = keep forever. Entries older than this are purged daily.' },
  // Refill (COD autoship)
  { key: 'refill.discountPercent', label: 'Refill discount (%)', group: 'Refill', type: 'number', default: '15', hint: 'Discount applied to every Refill auto-order subtotal.' },
  { key: 'refill.noticeDays', label: 'Advance-notice days', group: 'Refill', type: 'days', default: '3', hint: 'SMS the customer this many days before each auto-order (with a skip link).' },
  { key: 'refill.frequencies', label: 'Frequency presets (days)', group: 'Refill', type: 'text', default: '30,45,60,90', hint: 'Comma-separated delivery intervals customers can pick (7–180 days each).' },
  // Search
  { key: 'search.weeklyDigest', label: 'Weekly search digest', group: 'Search', type: 'text', default: 'off', hint: 'on / off — email staff a weekly summary of top searches, zero-result terms and unstocked demand (needs SMTP).' },
  { key: 'search.digestRecipients', label: 'Search digest recipients', group: 'Search', type: 'text', default: '', hint: 'Comma-separated emails. Empty = every staff user with a role.' },
  // Shipping
  { key: 'shipping.freeThresholdEgp', label: 'Free-shipping threshold (EGP)', group: 'Shipping', type: 'number', default: '0', hint: '0 = shipping fees come from the per-type config.' },
  // Referrals
  { key: 'referral.firstYearPercent', label: 'Referral reward — first year (%)', group: 'Referrals', type: 'percent', default: '100' },
  { key: 'referral.afterPercent', label: 'Referral reward — after first year (%)', group: 'Referrals', type: 'percent', default: '50' },
  { key: 'referral.codePrefix', label: 'Referral code prefix', group: 'Referrals', type: 'text', default: 'VEEEY-', hint: 'Prefix added to every new referral code, e.g. "VEEEY-".' },
  { key: 'referral.codeLength', label: 'Referral code random length', group: 'Referrals', type: 'number', default: '8', hint: 'Number of random characters after the prefix (4–16).' },
  // Payments
  { key: 'payments.cardGateway', label: 'Card gateway', group: 'Payments', type: 'text', default: 'auto', hint: 'auto | kashier | opay — which gateway handles Visa/MasterCard (auto prefers Kashier). Configure keys in Providers.' },
  // Inventory reorder (Requests / To-buy)
  { key: 'inventory.featuredCollectionSlug', label: 'Featured collection (reorder)', group: 'Inventory', type: 'text', default: 'best-sellers', hint: 'Products in this collection use a 6-month sales window (instead of 3) for the To-buy "Short stock" list. Point it at Best Sellers or a manual Featured collection.' },
  // Post-delivery review requests
  { key: 'reviews.requestEnabled', label: 'Post-delivery review requests', group: 'Reviews', type: 'text', default: 'true', hint: 'true / false — email customers a review request a few days after their order is delivered (needs SMTP configured).' },
  { key: 'reviews.requestDelayDays', label: 'Review request delay (days)', group: 'Reviews', type: 'days', default: '7', hint: 'Days after delivery before the review-request email is sent.' },
  // Abandoned-cart recovery
  { key: 'alerts.wishlistEmailEnabled', label: 'Wishlist alert emails', group: 'Alerts', type: 'text', default: 'true', hint: 'true / false — email wishlist price-drop / back-in-stock alerts (needs SMTP). Push alerts always fire for subscribed devices.' },
  { key: 'cart.abandonedReminderEnabled', label: 'Abandoned-cart reminders', group: 'Cart', type: 'text', default: 'true', hint: 'true / false — email signed-in customers a reminder when they leave items in the cart (needs SMTP). Guest carts cannot be emailed.' },
  { key: 'cart.abandonedIdleHours', label: 'Abandoned-cart idle (hours)', group: 'Cart', type: 'number', default: '6', hint: 'Hours a cart must sit untouched before one reminder is sent.' },
  // Checkout
  { key: 'checkout.requireVerification', label: 'Require verified contact to checkout', group: 'Checkout', type: 'text', default: 'false', hint: 'true / false — shoppers must confirm a one-time code sent to their phone (SMS) or email before placing an order. Needs SMS (and/or SMTP) configured in Providers. Verified accounts skip it on later orders.' },
  // Dashboard
  { key: 'dashboard.quickCardCount', label: 'Dashboard quick cards', group: 'Dashboard', type: 'number', default: '8', hint: 'How many "quick access" shortcut cards show at the top of the dashboard (3–10). They lay out in one or two rows.' },
  // Analytics
  { key: 'analytics.bigOrderEgp', label: 'Big order threshold (EGP)', group: 'Analytics', type: 'number', default: '3000', hint: 'Orders at or above this total count as "Big orders" in the sales analytics Big-vs-Normal comparison.' },
  // Error logging
  { key: 'errorLog.enabled', label: 'System error logging', group: 'Errors', type: 'text', default: 'true', hint: 'true / false — record 404s and runtime/server errors to the Error log (Administration → Error log). Turn off to stop collecting them.' },
  // Customer segments (list filters)
  { key: 'customers.highValueEgp', label: 'High-value customer threshold (EGP)', group: 'Customers', type: 'number', default: '5000', hint: 'Lifetime spend at or above this marks a customer as "High value" in the customers segment filter.' },
  { key: 'customers.lapsedDays', label: 'Lapsed customer window (days)', group: 'Customers', type: 'days', default: '180', hint: 'A customer with past orders but none in this many days is counted as "Lapsed" in the customers segment filter.' },
  // Storefront
  { key: 'refill.enabled', label: 'Show "Subscribe with Refill" on products', group: 'Storefront', type: 'text', default: 'false', hint: 'true / false. Real recurring subscriptions are not built yet — keep "false" to hide the per-product subscribe option.' },
  // Store contact (shown in the footer / contact block)
  { key: 'store.contactEmail', label: 'Contact email', group: 'Store', type: 'text', default: 'info@veeey.com' },
  { key: 'store.phone', label: 'Phone number', group: 'Store', type: 'text', default: '', hint: 'Shown in the footer; tap-to-call on mobile.' },
  { key: 'store.whatsappNumber', label: 'WhatsApp number', group: 'Store', type: 'text', default: '201000000000', hint: 'Digits only, international format (no +).' },
  { key: 'store.addressEn', label: 'Address (English)', group: 'Store', type: 'text', default: '' },
  { key: 'store.addressAr', label: 'Address (Arabic)', group: 'Store', type: 'text', default: '' },
  // Homepage search-engine appearance (the <title> + description Google shows for veeey.com).
  { key: 'seo.homeTitleEn', label: 'Homepage title — English', group: 'SEO', type: 'text', default: 'Veeey — Premium Imported Supplements & Health Devices in Egypt', hint: 'The blue headline Google shows for your homepage. ~55–60 characters. Keep the brand + what you sell + Egypt.' },
  { key: 'seo.homeTitleAr', label: 'Homepage title — Arabic', group: 'SEO', type: 'text', default: 'فيي — مكمّلات غذائية وأجهزة صحية فاخرة مستوردة في مصر', hint: 'العنوان الذي يظهر في جوجل للصفحة الرئيسية. حوالي ٦٠ حرفًا.' },
  { key: 'seo.homeDescEn', label: 'Homepage description — English', group: 'SEO', type: 'text', default: 'Genuine supplements & health devices imported from the USA, UK & EU. Every lot dated before you buy, fast delivery across Egypt, and 15% off with Veeey Refill.', hint: 'The grey snippet under the title in Google. ~150–160 characters.' },
  { key: 'seo.homeDescAr', label: 'Homepage description — Arabic', group: 'SEO', type: 'text', default: 'مكمّلات غذائية وأجهزة صحية أصلية مستوردة من أمريكا وبريطانيا وأوروبا. تاريخ كل تشغيلة ظاهر قبل الشراء، توصيل سريع في كل مصر، وخصم ١٥٪ مع ريفيل من فيي.', hint: 'الوصف الذي يظهر أسفل العنوان في جوجل. حوالي ١٦٠ حرفًا.' },
  // Analytics data retention — visitor clickstream is purged after this many days.
  { key: 'analytics.retentionDays', label: 'Analytics retention (days)', group: 'Analytics', type: 'days', default: '90', hint: 'Visitor sessions + events older than this are auto-deleted daily. 0 = keep forever (raises privacy/legal obligations).' },
];

const DEFAULTS: Record<string, string> = Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));
const KNOWN = new Set(SETTINGS.map((s) => s.key));

/** All settings as a key→value map (defaults merged with stored overrides). */
export async function getAllSettings(): Promise<Record<string, string>> {
  let stored: Record<string, string> = {};
  try {
    const rows = await prisma.setting.findMany();
    stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    // table missing / DB hiccup → fall back to defaults
  }
  return { ...DEFAULTS, ...stored };
}

export async function getSetting(key: string): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (row) return row.value;
  } catch {
    // ignore
  }
  return DEFAULTS[key] ?? '';
}

export async function getNumberSetting(key: string): Promise<number> {
  const n = Number(await getSetting(key));
  return Number.isFinite(n) ? n : Number(DEFAULTS[key] ?? 0);
}

export async function saveSettings(values: Record<string, string>) {
  const user = await requirePermission('settings.manage');
  const entries = Object.entries(values).filter(([k]) => KNOWN.has(k));
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
  await audit({ actorType: 'USER', actorId: user.id, action: 'settings.update', entityType: 'Setting', entityId: '*' });
}
