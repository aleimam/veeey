import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { InUseError } from '@/lib/soft-delete-service';

/**
 * Two-level payment methods.
 *  • CUSTOMER_METHODS — fixed list shown at checkout (what the shopper pays with).
 *  • SystemPaymentMethod — admin-editable granular list shown on invoice/packing,
 *    each mapping to a customer-facing code. `courier` qualifies COD variants for
 *    auto-derive; `sourceAliases` classify imported WooCommerce orders.
 * Order.paymentMethod = customer-facing code; Order.systemPaymentMethod = granular.
 */

// ---- Customer-facing (fixed) ----------------------------------------------
export type CustomerMethod = { code: string; labelEn: string; labelAr: string; online: boolean; gateway?: 'OPAY' | 'KASHIER'; requiresPosArea?: boolean };
export const CUSTOMER_METHODS: CustomerMethod[] = [
  { code: 'COD', labelEn: 'Cash on Delivery', labelAr: 'الدفع عند الاستلام', online: false },
  { code: 'BANK_TRANSFER', labelEn: 'Bank Transfer / InstaPay / Wallet', labelAr: 'تحويل بنكي / إنستاباي / محفظة', online: false },
  { code: 'CARD_OPAY', labelEn: 'Credit/Debit Card (OPay)', labelAr: 'بطاقة ائتمان/خصم (OPay)', online: true, gateway: 'OPAY' },
  { code: 'CARD_KASHIER', labelEn: 'Credit/Debit Card (Kashier)', labelAr: 'بطاقة ائتمان/خصم (Kashier)', online: true, gateway: 'KASHIER' },
  { code: 'POS_ON_DELIVERY', labelEn: 'POS on Delivery', labelAr: 'دفع بالبطاقة عند الاستلام', online: false, requiresPosArea: true },
];
const CUSTOMER_BY_CODE = new Map(CUSTOMER_METHODS.map((m) => [m.code, m]));
export const customerMethod = (code: string | null | undefined) => (code ? CUSTOMER_BY_CODE.get(code) ?? null : null);
export const customerLabel = (code: string | null | undefined, locale = 'en') => { const m = customerMethod(code); return m ? (locale === 'ar' ? m.labelAr : m.labelEn) : (code ?? '—'); };
export const isOnlineMethod = (code: string | null | undefined) => !!customerMethod(code)?.online;
export const gatewayFor = (code: string | null | undefined) => customerMethod(code)?.gateway ?? null;

/** Methods offered at checkout. POS-on-Delivery is hidden unless the area allows it. */
export function enabledCustomerMethods(locale = 'en', opts: { posAllowed?: boolean } = {}) {
  return CUSTOMER_METHODS.filter((m) => !m.requiresPosArea || opts.posAllowed).map((m) => ({ code: m.code, label: locale === 'ar' ? m.labelAr : m.labelEn, online: m.online }));
}

// ---- System (editable, DB) -------------------------------------------------
export type SystemMethodRow = { id: string; code: string; labelEn: string; labelAr: string | null; customerCode: string; courier: string | null; sourceAliases: string[]; active: boolean; sortOrder: number };

const SYSTEM_SEED: Array<Omit<SystemMethodRow, 'id'>> = [
  { code: 'COD_OWN', labelEn: 'Cash on Delivery (Our Staff)', labelAr: 'الدفع عند الاستلام (مندوبنا)', customerCode: 'COD', courier: 'OWN', sourceAliases: ['cod', 'cash', 'cod_own'], active: true, sortOrder: 1 },
  { code: 'COD_SMSA', labelEn: 'Cash on Delivery (SMSA)', labelAr: 'الدفع عند الاستلام (سمسا)', customerCode: 'COD', courier: 'SMSA', sourceAliases: ['cod_smsa'], active: true, sortOrder: 2 },
  { code: 'COD_ARAMEX', labelEn: 'Cash on Delivery (Aramex)', labelAr: 'الدفع عند الاستلام (أرامكس)', customerCode: 'COD', courier: 'ARAMEX', sourceAliases: ['cod_aramex'], active: true, sortOrder: 3 },
  { code: 'OPAY', labelEn: 'OPay', labelAr: 'OPay', customerCode: 'CARD_OPAY', courier: null, sourceAliases: ['opay'], active: true, sortOrder: 4 },
  { code: 'KASHIER', labelEn: 'Kashier', labelAr: 'Kashier', customerCode: 'CARD_KASHIER', courier: null, sourceAliases: ['kashier', 'kashier_card'], active: true, sortOrder: 5 },
  { code: 'POS_GEDIEA', labelEn: 'Gediea POS', labelAr: 'جديعة POS', customerCode: 'POS_ON_DELIVERY', courier: null, sourceAliases: ['gediea', 'gediea_pos'], active: true, sortOrder: 6 },
  { code: 'POS_AMAN', labelEn: 'Aman POS', labelAr: 'أمان POS', customerCode: 'POS_ON_DELIVERY', courier: null, sourceAliases: ['aman', 'aman_pos'], active: true, sortOrder: 7 },
  { code: 'POS_KASHIER', labelEn: 'Kashier POS', labelAr: 'Kashier POS', customerCode: 'POS_ON_DELIVERY', courier: null, sourceAliases: ['kashier_pos'], active: true, sortOrder: 8 },
  { code: 'BANK_ALEX', labelEn: 'Bank Transfer / InstaPay (Alex Bank)', labelAr: 'تحويل بنكي / إنستاباي (بنك الإسكندرية)', customerCode: 'BANK_TRANSFER', courier: null, sourceAliases: ['alexbank', 'bank_alex', 'instapay_alex'], active: true, sortOrder: 9 },
  { code: 'BANK_OTHER', labelEn: 'Bank Transfer / InstaPay (Other Banks)', labelAr: 'تحويل بنكي / إنستاباي (بنوك أخرى)', customerCode: 'BANK_TRANSFER', courier: null, sourceAliases: ['bacs', 'bank', 'bank_transfer', 'instapay'], active: true, sortOrder: 10 },
  { code: 'WALLET', labelEn: 'Mobile Wallet', labelAr: 'محفظة إلكترونية', customerCode: 'BANK_TRANSFER', courier: null, sourceAliases: ['wallet', 'vodafone_cash', 'fawry', 'mobile_wallet'], active: true, sortOrder: 11 },
];

let cache: { at: number; rows: SystemMethodRow[] } | null = null;
const TTL = 60_000;
export function invalidatePaymentCache() { cache = null; }

async function ensureSeeded() {
  if ((await prisma.systemPaymentMethod.count()) === 0) await prisma.systemPaymentMethod.createMany({ data: SYSTEM_SEED, skipDuplicates: true });
}

export async function listSystemMethods(): Promise<SystemMethodRow[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return cache.rows;
  await ensureSeeded();
  const rows = (await prisma.systemPaymentMethod.findMany({ orderBy: [{ sortOrder: 'asc' }, { labelEn: 'asc' }] })) as SystemMethodRow[];
  cache = { at: now, rows };
  return rows;
}

const sysLabel = (m: SystemMethodRow, locale: string) => (locale === 'ar' ? m.labelAr || m.labelEn : m.labelEn);

export async function systemMethodLabel(code: string | null | undefined, locale = 'en'): Promise<string | null> {
  if (!code) return null;
  const m = (await listSystemMethods()).find((x) => x.code === code);
  return m ? sysLabel(m, locale) : code;
}

/** Label for invoice/packing: the system (granular) label if set, else the customer-facing label. */
export async function invoicePaymentLabel(systemCode: string | null | undefined, customerCode: string | null | undefined, locale = 'en'): Promise<string> {
  return (await systemMethodLabel(systemCode, locale)) ?? customerLabel(customerCode, locale);
}

/** Derive the granular system method from the customer choice + courier (new orders).
 *  COD → COD_<courier> once a courier is known; cards → their gateway method;
 *  POS / bank transfer → null (staff pick the exact one). */
export async function deriveSystemMethod(customerCode: string | null | undefined, courier: string | null | undefined): Promise<string | null> {
  if (!customerCode) return null;
  const rows = await listSystemMethods();
  if (customerCode === 'COD') return courier ? rows.find((r) => r.customerCode === 'COD' && r.courier === courier && r.active)?.code ?? null : null;
  if (customerCode === 'CARD_OPAY' || customerCode === 'CARD_KASHIER') return rows.find((r) => r.customerCode === customerCode && r.active)?.code ?? null;
  return null; // POS_ON_DELIVERY / BANK_TRANSFER → staff choose
}

/** Resolve a raw WooCommerce payment_method to { system, customer } codes via aliases. */
export async function resolveImportPayment(wcRaw: string): Promise<{ systemCode: string | null; customerCode: string | null }> {
  const key = wcRaw.trim().toLowerCase();
  if (!key) return { systemCode: null, customerCode: null };
  const rows = await listSystemMethods();
  const exact = rows.find((r) => r.sourceAliases.some((a) => a.toLowerCase() === key));
  const hit = exact ?? rows.find((r) => r.sourceAliases.some((a) => a && key.includes(a.toLowerCase())));
  return hit ? { systemCode: hit.code, customerCode: hit.customerCode } : { systemCode: null, customerCode: null };
}

// ---- CRUD (settings.manage) ------------------------------------------------
export type SystemMethodInput = { code: string; labelEn: string; labelAr?: string | null; customerCode: string; courier?: string | null; sourceAliases?: string[]; active?: boolean; sortOrder?: number };

export async function saveSystemMethod(id: string | null, input: SystemMethodInput) {
  const user = await requirePermission('settings.manage');
  if (!CUSTOMER_BY_CODE.has(input.customerCode)) throw new Error('BAD_CUSTOMER_CODE');
  const courier = input.courier && ['OWN', 'SMSA', 'ARAMEX'].includes(input.courier) ? input.courier : null;
  const data = {
    labelEn: input.labelEn.trim(),
    labelAr: input.labelAr?.trim() || null,
    customerCode: input.customerCode,
    courier,
    sourceAliases: (input.sourceAliases ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean),
    active: input.active ?? true,
    sortOrder: input.sortOrder ?? 0,
  };
  const row = id
    ? await prisma.systemPaymentMethod.update({ where: { id }, data })
    : await prisma.systemPaymentMethod.create({ data: { ...data, code: input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') } });
  invalidatePaymentCache();
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'system_payment.update' : 'system_payment.create', entityType: 'SystemPaymentMethod', entityId: row.id });
  return row;
}

export async function setSystemMethodActive(id: string, active: boolean) {
  const user = await requirePermission('settings.manage');
  await prisma.systemPaymentMethod.update({ where: { id }, data: { active } });
  invalidatePaymentCache();
  await audit({ actorType: 'USER', actorId: user.id, action: active ? 'system_payment.activate' : 'system_payment.deactivate', entityType: 'SystemPaymentMethod', entityId: id });
}

export async function deleteSystemMethod(id: string) {
  const user = await requirePermission('settings.manage');
  const m = await prisma.systemPaymentMethod.findUnique({ where: { id }, select: { code: true } });
  if (!m) return;
  if ((await prisma.order.count({ where: { systemPaymentMethod: m.code } })) > 0) throw new InUseError();
  await prisma.systemPaymentMethod.delete({ where: { id } });
  invalidatePaymentCache();
  await audit({ actorType: 'USER', actorId: user.id, action: 'system_payment.delete', entityType: 'SystemPaymentMethod', entityId: id });
}

/** Re-classify imported orders (those with a stored raw value) by the current aliases. */
export async function remapOrderPayments(): Promise<number> {
  const user = await requirePermission('settings.manage');
  const orders = await prisma.order.findMany({ where: { legacyPaymentMethod: { not: null } }, select: { id: true, legacyPaymentMethod: true } });
  let changed = 0;
  for (const o of orders) {
    const { systemCode, customerCode } = await resolveImportPayment(o.legacyPaymentMethod ?? '');
    if (systemCode || customerCode) { await prisma.order.update({ where: { id: o.id }, data: { systemPaymentMethod: systemCode, ...(customerCode ? { paymentMethod: customerCode } : {}) } }); changed++; }
  }
  await audit({ actorType: 'USER', actorId: user.id, action: 'payment.remap', entityType: 'Order', entityId: `${changed} re-mapped` });
  return changed;
}
