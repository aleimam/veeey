import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/**
 * Messaging / AI provider config WRITERS (FR-NOT / FR-AI). Read-only resolvers
 * live in provider-config.ts (re-exported here for convenience). Per the owner's
 * decision these secrets live in the DB (settings.manage / super-admin) with
 * server env as fallback — a deliberate exception to "secrets in env only"
 * (AGENTS.md #7). Secrets are write-only in the UI; audited.
 */
export * from '@/lib/provider-config';

const PERM = 'settings.manage';
const SECRET_KEYS = new Set(['smtp.pass', 'ai.apiKey', 'sms.password', 'wa.token', 'opay.privateKey', 'kashier.apiKey', 'kashier.secretKey', 'aramex.password', 'aramex.accountPin', 'smsa.apiKey', 'smsa.passKey']);

async function saveKeys(keys: string[], values: Record<string, string>, prefix: string, action: string) {
  const user = await requirePermission(PERM);
  const ops = keys.map((key) => {
    const v = (values[key] ?? '').trim();
    if (SECRET_KEYS.has(key)) {
      // blank secret → keep existing (no-op); else upsert
      return v ? prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } }) : prisma.setting.findUnique({ where: { key } });
    }
    return v
      ? prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } })
      : prisma.setting.deleteMany({ where: { key } });
  });
  await prisma.$transaction(ops);
  await audit({ actorType: 'USER', actorId: user.id, action, entityType: 'Setting', entityId: `${prefix}*` });
}

export function saveSmtpConfig(values: Record<string, string>) {
  return saveKeys(['smtp.host', 'smtp.port', 'smtp.secure', 'smtp.user', 'smtp.from', 'smtp.fromName', 'smtp.pass'], values, 'smtp.', 'provider.smtp.update');
}
export async function clearSmtpConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.smtp.clear', entityType: 'Setting', entityId: 'smtp.*' });
}

export function saveAiConfig(values: Record<string, string>) {
  return saveKeys(['ai.apiKey', 'ai.model', 'ai.enabled'], values, 'ai.', 'provider.ai.update');
}
export async function clearAiConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'ai.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.ai.clear', entityType: 'Setting', entityId: 'ai.*' });
}

export function saveSmsConfig(values: Record<string, string>) {
  return saveKeys(['sms.username', 'sms.sender', 'sms.environment', 'sms.language', 'sms.password'], values, 'sms.', 'provider.sms.update');
}
export async function clearSmsConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'sms.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.sms.clear', entityType: 'Setting', entityId: 'sms.*' });
}

export function saveWhatsappConfig(values: Record<string, string>) {
  return saveKeys(['wa.sender', 'wa.token'], values, 'wa.', 'provider.wa.update');
}
export async function clearWhatsappConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'wa.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.wa.clear', entityType: 'Setting', entityId: 'wa.*' });
}

// ---- Payments: OPay --------------------------------------------------------
export function saveOpayConfig(values: Record<string, string>) {
  return saveKeys(['opay.merchantId', 'opay.publicKey', 'opay.environment', 'opay.privateKey'], values, 'opay.', 'provider.opay.update');
}
export async function clearOpayConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'opay.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.opay.clear', entityType: 'Setting', entityId: 'opay.*' });
}

// ---- Payments: Kashier -----------------------------------------------------
export function saveKashierConfig(values: Record<string, string>) {
  return saveKeys(['kashier.merchantId', 'kashier.environment', 'kashier.apiKey', 'kashier.secretKey'], values, 'kashier.', 'provider.kashier.update');
}
export async function clearKashierConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'kashier.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.kashier.clear', entityType: 'Setting', entityId: 'kashier.*' });
}

// ---- Shipping carrier: Aramex ----------------------------------------------
export function saveAramexConfig(values: Record<string, string>) {
  return saveKeys(['aramex.username', 'aramex.accountNumber', 'aramex.accountEntity', 'aramex.accountCountryCode', 'aramex.environment', 'aramex.password', 'aramex.accountPin'], values, 'aramex.', 'provider.aramex.update');
}
export async function clearAramexConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'aramex.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.aramex.clear', entityType: 'Setting', entityId: 'aramex.*' });
}

// ---- Shipping carrier: SMSA ------------------------------------------------
export function saveSmsaConfig(values: Record<string, string>) {
  return saveKeys(['smsa.environment', 'smsa.apiKey', 'smsa.passKey'], values, 'smsa.', 'provider.smsa.update');
}
export async function clearSmsaConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'smsa.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.smsa.clear', entityType: 'Setting', entityId: 'smsa.*' });
}
