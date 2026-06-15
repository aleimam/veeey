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
  // Special orders
  { key: 'specialOrder.depositPercent', label: 'Special-order deposit (%)', group: 'Special orders', type: 'percent', default: '25', hint: 'Deposit required to reserve a special order.' },
  { key: 'specialOrder.defaultLeadDays', label: 'Default lead time (days)', group: 'Special orders', type: 'days', default: '20' },
  { key: 'specialOrder.compensationGraceDays', label: 'Compensation grace (days)', group: 'Special orders', type: 'days', default: '3', hint: 'Days past the promised date before auto-compensation applies.' },
  // Shipping
  { key: 'shipping.freeThresholdEgp', label: 'Free-shipping threshold (EGP)', group: 'Shipping', type: 'number', default: '0', hint: '0 = shipping fees come from the per-type config.' },
  // Referrals
  { key: 'referral.firstYearPercent', label: 'Referral reward — first year (%)', group: 'Referrals', type: 'percent', default: '100' },
  { key: 'referral.afterPercent', label: 'Referral reward — after first year (%)', group: 'Referrals', type: 'percent', default: '50' },
  // Payments
  { key: 'payments.cardGateway', label: 'Card gateway', group: 'Payments', type: 'text', default: 'auto', hint: 'auto | kashier | opay — which gateway handles Visa/MasterCard (auto prefers Kashier). Configure keys in Providers.' },
  // Store contact
  { key: 'store.contactEmail', label: 'Contact email', group: 'Store', type: 'text', default: 'info@veeey.com' },
  { key: 'store.whatsappNumber', label: 'WhatsApp number', group: 'Store', type: 'text', default: '201000000000', hint: 'Digits only, international format (no +).' },
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
