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

// ---- SMS (SMSMisr / sms.com.eg) --------------------------------------------
export type SmsConfig = { username: string; password: string; sender: string; environment: string; language: string };

/** Normalize an Egyptian mobile to SMSMisr's `2011…` form (country code, no +/0). */
export function normalizeMobile(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('20')) return d;
  if (d.startsWith('0')) return `20${d.slice(1)}`;
  return d;
}

export async function getSmsConfig(): Promise<SmsConfig | null> {
  const m = await rawMap('sms.');
  const username = m['sms.username'] || process.env.SMS_USERNAME;
  const password = m['sms.password'] || process.env.SMS_PASSWORD;
  const sender = m['sms.sender'] || process.env.SMS_SENDER;
  if (!username || !password || !sender) return null;
  return {
    username,
    password,
    sender,
    environment: m['sms.environment'] || process.env.SMS_ENVIRONMENT || '2', // default Test for safety
    language: m['sms.language'] || process.env.SMS_LANGUAGE || '1',
  };
}
export const smsConfigured = async () => !!(await getSmsConfig());

export async function getSmsFormValues() {
  const m = await rawMap('sms.');
  return {
    username: m['sms.username'] ?? '',
    sender: m['sms.sender'] ?? '',
    environment: m['sms.environment'] ?? '2',
    language: m['sms.language'] ?? '1',
    hasPass: !!m['sms.password'],
  };
}

// ---- WhatsApp (config-only for now) ----------------------------------------
export async function getWhatsappFormValues() {
  const m = await rawMap('wa.');
  return { sender: m['wa.sender'] ?? '', hasToken: !!m['wa.token'] };
}

// ---- Payments: OPay (hosted Cashier) ---------------------------------------
// merchantId + publicKey are not secret; privateKey signs requests (secret).
export type OpayConfig = { merchantId: string; publicKey: string; privateKey: string; environment: string };

export async function getOpayConfig(): Promise<OpayConfig | null> {
  const m = await rawMap('opay.');
  const merchantId = m['opay.merchantId'] || process.env.OPAY_MERCHANT_ID;
  const publicKey = m['opay.publicKey'] || process.env.OPAY_PUBLIC_KEY;
  const privateKey = m['opay.privateKey'] || process.env.OPAY_SECRET_KEY;
  if (!merchantId || !publicKey || !privateKey) return null;
  return { merchantId, publicKey, privateKey, environment: m['opay.environment'] || process.env.OPAY_ENVIRONMENT || 'sandbox' };
}
export const opayConfigured = async () => !!(await getOpayConfig());

export async function getOpayFormValues() {
  const m = await rawMap('opay.');
  return {
    merchantId: m['opay.merchantId'] ?? '',
    publicKey: m['opay.publicKey'] ?? '',
    environment: m['opay.environment'] ?? 'sandbox',
    hasPrivate: !!m['opay.privateKey'],
  };
}

// ---- Payments: Kashier (hosted payment page / iframe) ----------------------
// apiKey builds the checkout hash; secretKey verifies webhooks. Both secret.
export type KashierConfig = { merchantId: string; apiKey: string; secretKey: string; environment: string };

export async function getKashierConfig(): Promise<KashierConfig | null> {
  const m = await rawMap('kashier.');
  const merchantId = m['kashier.merchantId'] || process.env.KASHIER_MID;
  const apiKey = m['kashier.apiKey'] || process.env.KASHIER_API_KEY;
  const secretKey = m['kashier.secretKey'] || process.env.KASHIER_SECRET_KEY || '';
  if (!merchantId || !apiKey) return null;
  return { merchantId, apiKey, secretKey, environment: m['kashier.environment'] || process.env.KASHIER_ENVIRONMENT || 'test' };
}
export const kashierConfigured = async () => !!(await getKashierConfig());

export async function getKashierFormValues() {
  const m = await rawMap('kashier.');
  return {
    merchantId: m['kashier.merchantId'] ?? '',
    environment: m['kashier.environment'] ?? 'test',
    hasApiKey: !!m['kashier.apiKey'],
    hasSecret: !!m['kashier.secretKey'],
  };
}

// ---- Shipping carrier: Aramex (Shipping Services API) ----------------------
// password + accountPin are secret; ClientInfo also needs entity + country code.
export type AramexConfig = { username: string; password: string; accountNumber: string; accountPin: string; accountEntity: string; accountCountryCode: string; environment: string };

export async function getAramexConfig(): Promise<AramexConfig | null> {
  const m = await rawMap('aramex.');
  const username = m['aramex.username'] || process.env.ARAMEX_USERNAME;
  const password = m['aramex.password'] || process.env.ARAMEX_PASSWORD;
  const accountNumber = m['aramex.accountNumber'] || process.env.ARAMEX_ACCOUNT_NUMBER;
  const accountPin = m['aramex.accountPin'] || process.env.ARAMEX_ACCOUNT_PIN;
  if (!username || !password || !accountNumber || !accountPin) return null;
  return {
    username,
    password,
    accountNumber,
    accountPin,
    accountEntity: m['aramex.accountEntity'] || process.env.ARAMEX_ACCOUNT_ENTITY || 'CAI',
    accountCountryCode: m['aramex.accountCountryCode'] || process.env.ARAMEX_ACCOUNT_COUNTRY || 'EG',
    environment: m['aramex.environment'] || process.env.ARAMEX_ENVIRONMENT || 'test',
  };
}
export const aramexConfigured = async () => !!(await getAramexConfig());

export async function getAramexFormValues() {
  const m = await rawMap('aramex.');
  return {
    username: m['aramex.username'] ?? '',
    accountNumber: m['aramex.accountNumber'] ?? '',
    accountEntity: m['aramex.accountEntity'] ?? 'CAI',
    accountCountryCode: m['aramex.accountCountryCode'] ?? 'EG',
    environment: m['aramex.environment'] ?? 'test',
    hasPassword: !!m['aramex.password'],
    hasPin: !!m['aramex.accountPin'],
  };
}

// ---- Shipping carrier: SMSA (config-only until the REST eCommerce docs) -----
export type SmsaConfig = { apiKey: string; passKey: string; environment: string };

export async function getSmsaConfig(): Promise<SmsaConfig | null> {
  const m = await rawMap('smsa.');
  const apiKey = m['smsa.apiKey'] || process.env.SMSA_API_KEY || '';
  const passKey = m['smsa.passKey'] || process.env.SMSA_PASS_KEY || '';
  if (!apiKey && !passKey) return null;
  return { apiKey, passKey, environment: m['smsa.environment'] || process.env.SMSA_ENVIRONMENT || 'test' };
}
export const smsaConfigured = async () => !!(await getSmsaConfig());

export async function getSmsaFormValues() {
  const m = await rawMap('smsa.');
  return { environment: m['smsa.environment'] ?? 'test', hasApiKey: !!m['smsa.apiKey'], hasPassKey: !!m['smsa.passKey'] };
}
