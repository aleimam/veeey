import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { InUseError } from '@/lib/soft-delete-service';

/**
 * Admin-editable payment methods (replaces the old PaymentMethod enum). Orders
 * store the method `code`. In-use methods (referenced by an order) can be
 * deactivated/edited but not deleted. New methods are OFFLINE (settle on delivery
 * / manual); the online card method (CARD_GATEWAY via Kashier) is seeded and its
 * gateway isn't admin-editable. Also holds the WooCommerce → method mapping used
 * by the importer. 60s cache; invalidated on writes.
 */
export type PaymentKind = 'OFFLINE' | 'CARD_GATEWAY';
export type PaymentMethodRow = {
  id: string; code: string; labelEn: string; labelAr: string | null; kind: PaymentKind;
  gateway: string | null; active: boolean; sortOrder: number; instructionsEn: string | null; instructionsAr: string | null;
};

const SEED: Array<Omit<PaymentMethodRow, 'id'>> = [
  { code: 'COD', labelEn: 'Cash on Delivery', labelAr: 'الدفع عند الاستلام', kind: 'OFFLINE', gateway: null, active: true, sortOrder: 1, instructionsEn: null, instructionsAr: null },
  { code: 'POS_ON_DELIVERY', labelEn: 'Card machine on delivery', labelAr: 'ماكينة الدفع عند الاستلام', kind: 'OFFLINE', gateway: null, active: true, sortOrder: 2, instructionsEn: null, instructionsAr: null },
  { code: 'KASHIER', labelEn: 'Visa / MasterCard', labelAr: 'فيزا / ماستركارد', kind: 'CARD_GATEWAY', gateway: 'KASHIER', active: true, sortOrder: 3, instructionsEn: null, instructionsAr: null },
  { code: 'BANK_TRANSFER', labelEn: 'Bank transfer', labelAr: 'تحويل بنكي', kind: 'OFFLINE', gateway: null, active: true, sortOrder: 5, instructionsEn: null, instructionsAr: null },
  { code: 'WALLET', labelEn: 'Mobile wallet', labelAr: 'محفظة إلكترونية', kind: 'OFFLINE', gateway: null, active: true, sortOrder: 6, instructionsEn: null, instructionsAr: null },
];

let cache: { at: number; rows: PaymentMethodRow[] } | null = null;
const TTL = 60_000;
export function invalidatePaymentCache() { cache = null; }

async function ensureSeeded() {
  if ((await prisma.paymentMethodConfig.count()) === 0) {
    await prisma.paymentMethodConfig.createMany({ data: SEED, skipDuplicates: true });
  }
}

/** All methods (active + inactive), ordered — for the admin list. Cached. */
export async function listPaymentMethods(): Promise<PaymentMethodRow[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return cache.rows;
  await ensureSeeded();
  const rows = (await prisma.paymentMethodConfig.findMany({ orderBy: [{ sortOrder: 'asc' }, { labelEn: 'asc' }] })) as PaymentMethodRow[];
  cache = { at: now, rows };
  return rows;
}

const pickLabel = (m: PaymentMethodRow, locale: string) => (locale === 'ar' ? m.labelAr || m.labelEn : m.labelEn);

/** Active methods offered at checkout / admin order creation. */
export async function enabledPaymentMethods(locale = 'en'): Promise<{ code: string; label: string; online: boolean; instructions: string | null }[]> {
  const rows = await listPaymentMethods();
  return rows.filter((m) => m.active).map((m) => ({ code: m.code, label: pickLabel(m, locale), online: m.kind === 'CARD_GATEWAY', instructions: locale === 'ar' ? m.instructionsAr : m.instructionsEn }));
}

/** Human label for any (incl. inactive / legacy) method code. */
export async function paymentMethodLabel(code: string | null | undefined, locale = 'en'): Promise<string> {
  if (!code) return '—';
  const m = (await listPaymentMethods()).find((x) => x.code === code);
  return m ? pickLabel(m, locale) : code;
}

export async function isOnlineMethod(code: string | null | undefined): Promise<boolean> {
  if (!code) return false;
  return (await listPaymentMethods()).find((x) => x.code === code)?.kind === 'CARD_GATEWAY';
}

// ---- CRUD (settings.manage) ------------------------------------------------
export type PaymentMethodInput = { code: string; labelEn: string; labelAr?: string | null; active?: boolean; sortOrder?: number; instructionsEn?: string | null; instructionsAr?: string | null };

export async function savePaymentMethod(id: string | null, input: PaymentMethodInput) {
  const user = await requirePermission('settings.manage');
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const data = {
    labelEn: input.labelEn.trim(),
    labelAr: input.labelAr?.trim() || null,
    active: input.active ?? true,
    sortOrder: input.sortOrder ?? 0,
    instructionsEn: input.instructionsEn?.trim() || null,
    instructionsAr: input.instructionsAr?.trim() || null,
  };
  const row = id
    ? await prisma.paymentMethodConfig.update({ where: { id }, data }) // code + kind are immutable after create
    : await prisma.paymentMethodConfig.create({ data: { ...data, code, kind: 'OFFLINE', gateway: null } }); // new = offline
  invalidatePaymentCache();
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'payment_method.update' : 'payment_method.create', entityType: 'PaymentMethodConfig', entityId: row.id });
  return row;
}

export async function setPaymentMethodActive(id: string, active: boolean) {
  const user = await requirePermission('settings.manage');
  await prisma.paymentMethodConfig.update({ where: { id }, data: { active } });
  invalidatePaymentCache();
  await audit({ actorType: 'USER', actorId: user.id, action: active ? 'payment_method.activate' : 'payment_method.deactivate', entityType: 'PaymentMethodConfig', entityId: id });
}

export async function deletePaymentMethod(id: string) {
  const user = await requirePermission('settings.manage');
  const m = await prisma.paymentMethodConfig.findUnique({ where: { id }, select: { code: true } });
  if (!m) return;
  const inUse = await prisma.order.count({ where: { paymentMethod: m.code } });
  if (inUse > 0) throw new InUseError(); // used by orders → deactivate instead
  await prisma.paymentMethodConfig.delete({ where: { id } });
  invalidatePaymentCache();
  await audit({ actorType: 'USER', actorId: user.id, action: 'payment_method.delete', entityType: 'PaymentMethodConfig', entityId: id });
}

// ---- WooCommerce → method mapping (importer) -------------------------------
let mapCache: { at: number; map: Record<string, string> } | null = null;

export async function getPaymentMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (mapCache && now - mapCache.at < TTL) return mapCache.map;
  const row = await prisma.setting.findUnique({ where: { key: 'woo.paymentMap' } });
  let map: Record<string, string> = {};
  try { map = row?.value ? (JSON.parse(row.value) as Record<string, string>) : {}; } catch { map = {}; }
  mapCache = { at: now, map };
  return map;
}

export async function savePaymentMap(map: Record<string, string>) {
  const user = await requirePermission('settings.manage');
  const clean = Object.fromEntries(Object.entries(map).filter(([k, v]) => k && v));
  await prisma.setting.upsert({ where: { key: 'woo.paymentMap' }, update: { value: JSON.stringify(clean) }, create: { key: 'woo.paymentMap', value: JSON.stringify(clean) } });
  mapCache = null;
  await audit({ actorType: 'USER', actorId: user.id, action: 'payment_map.update', entityType: 'Setting', entityId: 'woo.paymentMap' });
}

/** Resolve a WooCommerce payment_method to a Veeey method code: admin map first,
 *  then sensible defaults. Pure (map fetched once per sync run). */
export function mapWooPayment(wc: string, map: Record<string, string>): string | null {
  const key = wc.trim().toLowerCase();
  if (!key) return null;
  if (map[key]) return map[key];
  if (key.includes('cod') || key.includes('cash')) return 'COD';
  if (key.includes('bacs') || key.includes('bank')) return 'BANK_TRANSFER';
  if (key.includes('kashier') || key.includes('card') || key.includes('visa') || key.includes('paymob') || key.includes('opay')) return 'KASHIER';
  if (key.includes('wallet') || key.includes('vodafone') || key.includes('fawry')) return 'WALLET';
  return null;
}

/** Re-map already-imported orders that have a stored legacy payment string. */
export async function remapOrderPayments(): Promise<number> {
  const user = await requirePermission('settings.manage');
  const map = await getPaymentMap();
  const orders = await prisma.order.findMany({ where: { legacyPaymentMethod: { not: null } }, select: { id: true, legacyPaymentMethod: true } });
  let changed = 0;
  for (const o of orders) {
    const code = mapWooPayment(o.legacyPaymentMethod ?? '', map);
    if (code) { await prisma.order.update({ where: { id: o.id }, data: { paymentMethod: code } }); changed++; }
  }
  await audit({ actorType: 'USER', actorId: user.id, action: 'payment_map.remap', entityType: 'Order', entityId: `${changed} re-mapped` });
  return changed;
}
