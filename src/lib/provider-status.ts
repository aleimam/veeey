import { prisma } from '@/lib/prisma';

/**
 * Persisted "last check/test result" per provider (admin → Providers). The live
 * checks (provider-check.ts) and the SMS/email test actions call `recordProvider
 * Status`; the providers page + its top summary table read the stored result so
 * badges survive page loads without re-hitting external APIs on every render.
 */
export type ProviderKey = 'email' | 'sms' | 'whatsapp' | 'ai' | 'opay' | 'kashier' | 'aramex' | 'smsa';
export type ProviderStatusValue = 'ok' | 'warn' | 'fail' | 'skip';
export type ProviderStatus = { status: ProviderStatusValue; code?: string; at: string };

const KEY = (p: ProviderKey) => `providerstatus.${p}`;

export async function recordProviderStatus(p: ProviderKey, status: ProviderStatusValue, code: string | undefined, at: string): Promise<void> {
  const value = JSON.stringify({ status, code, at });
  try {
    await prisma.setting.upsert({ where: { key: KEY(p) }, update: { value }, create: { key: KEY(p), value } });
  } catch {
    // best-effort — never block the check/test itself
  }
}

export async function getAllProviderStatus(): Promise<Partial<Record<ProviderKey, ProviderStatus>>> {
  const out: Partial<Record<ProviderKey, ProviderStatus>> = {};
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'providerstatus.' } } });
    for (const r of rows) {
      const key = r.key.slice('providerstatus.'.length) as ProviderKey;
      try {
        out[key] = JSON.parse(r.value) as ProviderStatus;
      } catch {
        /* skip malformed */
      }
    }
  } catch {
    // table missing / DB hiccup → empty (badges fall back to "configured" only)
  }
  return out;
}
