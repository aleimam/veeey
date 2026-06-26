import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { invalidateWooCache } from '@/lib/woocommerce';

/**
 * WooCommerce connector WRITERS. The consumer secret is write-only in the UI
 * (blank = keep existing). Gated by `settings.manage`, audited. Read-only
 * resolvers + the REST client live in woocommerce.ts.
 */
const PERM = 'settings.manage';
const SECRET = new Set(['woo.consumerSecret']);

export async function saveWooConfig(values: Record<string, string>) {
  const user = await requirePermission(PERM);
  const keys = ['woo.url', 'woo.consumerKey', 'woo.consumerSecret'];
  const ops = keys.map((key) => {
    const v = (values[key] ?? '').trim();
    if (SECRET.has(key)) {
      return v
        ? prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } })
        : prisma.setting.findUnique({ where: { key } });
    }
    return v
      ? prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } })
      : prisma.setting.deleteMany({ where: { key } });
  });
  await prisma.$transaction(ops);
  invalidateWooCache();
  await audit({ actorType: 'USER', actorId: user.id, action: 'woo.update', entityType: 'Setting', entityId: 'woo.*' });
}

export async function saveSyncSettings(values: Record<string, string>) {
  const user = await requirePermission(PERM);
  const flagKeys = ['woo.sync.enabled', 'woo.sync.products', 'woo.sync.customers', 'woo.sync.orders'];
  const ops = flagKeys
    .filter((k) => values[k] != null)
    .map((k) => prisma.setting.upsert({ where: { key: k }, update: { value: values[k] }, create: { key: k, value: values[k] } }));
  const sec = (values['woo.webhookSecret'] ?? '').trim();
  if (sec) ops.push(prisma.setting.upsert({ where: { key: 'woo.webhookSecret' }, update: { value: sec }, create: { key: 'woo.webhookSecret', value: sec } }));
  if (ops.length) await prisma.$transaction(ops);
  invalidateWooCache();
  await audit({ actorType: 'USER', actorId: user.id, action: 'woo.sync.settings', entityType: 'Setting', entityId: 'woo.sync.*' });
}

export async function clearWooConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'woo.' } } });
  invalidateWooCache();
  await audit({ actorType: 'USER', actorId: user.id, action: 'woo.clear', entityType: 'Setting', entityId: 'woo.*' });
}
