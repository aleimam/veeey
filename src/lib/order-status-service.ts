import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import {
  DEFAULT_STATUS_CONFIG,
  toStatusMap,
  canTransitionWith,
  customerStatusOf as pureCustomerStatusOf,
  resolveStatusAlias,
  type StatusConfig,
  type StatusMap,
  type OrderStatus,
  type CustomerStatus,
} from '@/lib/order-status';

/**
 * DB-backed order-status config (STAT). Cached with lazy-seed from
 * DEFAULT_STATUS_CONFIG, mirroring payment-method-service. The 8 codes are fixed
 * (no add/delete); their behavior is editable. `Order.status` stores the code.
 */

let cache: { at: number; rows: StatusConfig[] } | null = null;
const TTL = 60_000;
export function invalidateStatusCache() { cache = null; }

const toConfig = (r: {
  code: string; labelEn: string; labelAr: string | null; customerCode: string | null; icon: string;
  stockEffect: string; paymentEffect: string; revenueEffect: string; loyaltyEffect: string;
  notifyAudience: string; notifyTemplateKey: string | null; allowedNext: string[]; sourceAliases: string[];
  sortOrder: number; active: boolean; isDefault: boolean;
}): StatusConfig => ({
  code: r.code as OrderStatus,
  labelEn: r.labelEn,
  labelAr: r.labelAr ?? r.labelEn,
  customerCode: (r.customerCode as CustomerStatus | null) ?? null,
  icon: r.icon,
  stockEffect: r.stockEffect as StatusConfig['stockEffect'],
  paymentEffect: r.paymentEffect as StatusConfig['paymentEffect'],
  revenueEffect: r.revenueEffect as StatusConfig['revenueEffect'],
  loyaltyEffect: r.loyaltyEffect as StatusConfig['loyaltyEffect'],
  notifyAudience: r.notifyAudience as StatusConfig['notifyAudience'],
  notifyTemplateKey: r.notifyTemplateKey,
  allowedNext: (r.allowedNext as OrderStatus[]) ?? [],
  sourceAliases: r.sourceAliases ?? [],
  sortOrder: r.sortOrder,
  active: r.active,
  isDefault: r.isDefault,
});

async function ensureSeeded() {
  if ((await prisma.orderStatusConfig.count()) === 0) {
    await prisma.orderStatusConfig.createMany({
      data: DEFAULT_STATUS_CONFIG.map((c) => ({ ...c })),
      skipDuplicates: true,
    });
  }
}

export async function listStatusConfigs(): Promise<StatusConfig[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return cache.rows;
  await ensureSeeded();
  const rows = (await prisma.orderStatusConfig.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] })).map(toConfig);
  cache = { at: now, rows };
  return rows;
}

export async function statusMap(): Promise<StatusMap> {
  return toStatusMap(await listStatusConfigs());
}

export async function statusConfig(code: string): Promise<StatusConfig | undefined> {
  return (await statusMap()).get(code);
}

export async function canTransition(from: string, to: string): Promise<boolean> {
  return canTransitionWith(await statusMap(), from, to);
}

export async function customerStatusOf(code: string): Promise<CustomerStatus | null> {
  return pureCustomerStatusOf(await statusMap(), code);
}

/** Default status new orders start in (config-driven; falls back to PENDING). */
export async function defaultStatus(): Promise<OrderStatus> {
  return (await listStatusConfigs()).find((c) => c.isDefault)?.code ?? 'PENDING';
}

/** Resolve a raw legacy/import status to a system code via aliases. */
export async function resolveImportStatus(raw: string): Promise<OrderStatus | null> {
  return resolveStatusAlias(await statusMap(), raw);
}

/** Bilingual label for a status code. */
export async function statusLabel(code: string | null | undefined, locale = 'en'): Promise<string> {
  if (!code) return '—';
  const c = await statusConfig(code);
  return c ? (locale === 'ar' ? c.labelAr : c.labelEn) : code;
}

// ---- CRUD (settings.manage) ------------------------------------------------
export type StatusConfigInput = {
  labelEn: string; labelAr?: string | null; customerCode?: string | null; icon?: string;
  stockEffect?: string; paymentEffect?: string; revenueEffect?: string; loyaltyEffect?: string;
  notifyAudience?: string; notifyTemplateKey?: string | null; allowedNext?: string[]; sourceAliases?: string[];
  sortOrder?: number; active?: boolean;
};

/** Update an existing status code's behavior (codes are fixed; no create/delete). */
export async function saveStatusConfig(code: string, input: StatusConfigInput) {
  const user = await requirePermission('settings.manage');
  const allowedNext = (input.allowedNext ?? []).filter((c) => c !== code); // no self-loop
  const row = await prisma.orderStatusConfig.update({
    where: { code },
    data: {
      labelEn: input.labelEn.trim(),
      labelAr: input.labelAr?.trim() || null,
      customerCode: input.customerCode?.trim() || null,
      icon: input.icon?.trim() || 'circle',
      stockEffect: input.stockEffect ?? 'none',
      paymentEffect: input.paymentEffect ?? 'none',
      revenueEffect: input.revenueEffect ?? 'none',
      loyaltyEffect: input.loyaltyEffect ?? 'none',
      notifyAudience: input.notifyAudience ?? 'none',
      notifyTemplateKey: input.notifyTemplateKey?.trim() || null,
      allowedNext,
      sourceAliases: (input.sourceAliases ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean),
      sortOrder: input.sortOrder ?? 0,
      active: input.active ?? true,
    },
  });
  invalidateStatusCache();
  await audit({ actorType: 'USER', actorId: user.id, action: 'order_status.update', entityType: 'OrderStatusConfig', entityId: row.id });
  return row;
}

/** Re-classify imported orders (those with a stored raw value) by current aliases. */
export async function remapOrderStatuses(): Promise<number> {
  const user = await requirePermission('settings.manage');
  const map = await statusMap();
  const orders = await prisma.order.findMany({ where: { legacyStatus: { not: null } }, select: { id: true, legacyStatus: true } });
  let changed = 0;
  for (const o of orders) {
    const code = resolveStatusAlias(map, o.legacyStatus ?? '');
    if (!code) continue;
    const customer = pureCustomerStatusOf(map, code);
    await prisma.order.update({ where: { id: o.id }, data: { status: code, ...(customer ? { customerStatus: customer } : {}) } });
    changed++;
  }
  await audit({ actorType: 'USER', actorId: user.id, action: 'order_status.remap', entityType: 'Order', entityId: `${changed} re-mapped` });
  return changed;
}
