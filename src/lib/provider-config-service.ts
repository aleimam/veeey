import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/**
 * Messaging provider configuration (FR-NOT). Per the owner's decision these
 * provider credentials live in the DB (admin-editable, settings.manage / super-
 * admin), with server env as the fallback — a deliberate exception to the
 * "secrets in env only" default (AGENTS.md #7). Secrets are write-only in the
 * UI (never rendered back). SMS/WhatsApp keys are added in a later slice.
 */
const PERM = 'settings.manage';

const SECRET_KEYS = new Set(['smtp.pass']);

async function rawMap(prefix: string): Promise<Record<string, string>> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: prefix } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
};

/** Resolved SMTP config (DB overrides → env fallback). null when not configured. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const m = await rawMap('smtp.');
  const host = m['smtp.host'] || process.env.SMTP_HOST;
  const user = m['smtp.user'] || process.env.SMTP_USER;
  const pass = m['smtp.pass'] || process.env.SMTP_PASS || '';
  if (!host || !user) return null;
  const port = Number(m['smtp.port'] || process.env.SMTP_PORT || 587);
  const secure = (m['smtp.secure'] ?? process.env.SMTP_SECURE) === 'true' || port === 465;
  return {
    host,
    port,
    secure,
    user,
    pass,
    from: m['smtp.from'] || process.env.EMAIL_FROM || 'info@veeey.com',
    fromName: m['smtp.fromName'] || process.env.SMTP_FROM_NAME || 'Veeey',
  };
}

export const emailConfigured = async () => !!(await getSmtpConfig());

/** Non-secret SMTP values for the admin form (+ whether a password is stored). */
export async function getSmtpFormValues() {
  const m = await rawMap('smtp.');
  return {
    host: m['smtp.host'] ?? '',
    port: m['smtp.port'] ?? '',
    secure: (m['smtp.secure'] ?? '') === 'true',
    user: m['smtp.user'] ?? '',
    from: m['smtp.from'] ?? '',
    fromName: m['smtp.fromName'] ?? '',
    hasPass: !!m['smtp.pass'],
  };
}

/** Save SMTP config. Blank non-secret fields clear the override (env fallback);
 *  a blank password keeps the stored one (write-only). */
export async function saveSmtpConfig(values: Record<string, string>) {
  const user = await requirePermission(PERM);
  const ops = [];
  const fields = ['smtp.host', 'smtp.port', 'smtp.secure', 'smtp.user', 'smtp.from', 'smtp.fromName', 'smtp.pass'];
  for (const key of fields) {
    const v = (values[key] ?? '').trim();
    if (SECRET_KEYS.has(key)) {
      if (v) ops.push(prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } }));
      // blank secret → keep existing
    } else if (v) {
      ops.push(prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } }));
    } else {
      ops.push(prisma.setting.deleteMany({ where: { key } }));
    }
  }
  await prisma.$transaction(ops);
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.smtp.update', entityType: 'Setting', entityId: 'smtp.*' });
}

/** Clear all stored SMTP overrides (revert to env / unconfigured). */
export async function clearSmtpConfig() {
  const user = await requirePermission(PERM);
  await prisma.setting.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.smtp.clear', entityType: 'Setting', entityId: 'smtp.*' });
}
