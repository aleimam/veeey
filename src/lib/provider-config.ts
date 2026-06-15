import { prisma } from '@/lib/prisma';

/**
 * Read-only provider config resolvers (DB Setting `*.` keys → env fallback).
 * Kept free of auth/server-only imports so dispatch + the AI client (and their
 * unit tests) can import without pulling the RBAC/auth chain. Writers live in
 * provider-config-service.ts.
 */
export const DEFAULT_AI_MODEL = 'claude-opus-4-8';

async function rawMap(prefix: string): Promise<Record<string, string>> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: prefix } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

// ---- SMTP ------------------------------------------------------------------
export type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string; fromName: string };

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const m = await rawMap('smtp.');
  const host = m['smtp.host'] || process.env.SMTP_HOST;
  const user = m['smtp.user'] || process.env.SMTP_USER;
  const pass = m['smtp.pass'] || process.env.SMTP_PASS || '';
  if (!host || !user) return null;
  const port = Number(m['smtp.port'] || process.env.SMTP_PORT || 587);
  const secure = (m['smtp.secure'] ?? process.env.SMTP_SECURE) === 'true' || port === 465;
  return { host, port, secure, user, pass, from: m['smtp.from'] || process.env.EMAIL_FROM || 'info@veeey.com', fromName: m['smtp.fromName'] || process.env.SMTP_FROM_NAME || 'Veeey' };
}
export const emailConfigured = async () => !!(await getSmtpConfig());

export async function getSmtpFormValues() {
  const m = await rawMap('smtp.');
  return {
    host: m['smtp.host'] ?? '', port: m['smtp.port'] ?? '', secure: (m['smtp.secure'] ?? '') === 'true',
    user: m['smtp.user'] ?? '', from: m['smtp.from'] ?? '', fromName: m['smtp.fromName'] ?? '', hasPass: !!m['smtp.pass'],
  };
}

// ---- AI (Claude) -----------------------------------------------------------
export type AiConfig = { apiKey: string; model: string };

export async function getAiConfig(): Promise<AiConfig | null> {
  const m = await rawMap('ai.');
  const apiKey = m['ai.apiKey'] || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey || m['ai.enabled'] === 'false') return null;
  return { apiKey, model: m['ai.model'] || process.env.ANTHROPIC_MODEL || DEFAULT_AI_MODEL };
}
export const aiConfigured = async () => !!(await getAiConfig());

export async function getAiFormValues() {
  const m = await rawMap('ai.');
  return { model: m['ai.model'] ?? '', enabled: (m['ai.enabled'] ?? 'true') !== 'false', hasKey: !!m['ai.apiKey'], defaultModel: DEFAULT_AI_MODEL };
}
