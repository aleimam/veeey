/**
 * Order channel (FR-ORD-05) — how the order reached us. Stored on `Order.source`.
 * DIRECT is the storefront default and is NOT offered for staff-placed (backend)
 * orders, which must pick one of the other channels.
 */
export type Channel = { code: string; en: string; ar: string; storefrontOnly?: boolean };

export const CHANNELS: Channel[] = [
  { code: 'DIRECT', en: 'Direct', ar: 'مباشر', storefrontOnly: true },
  { code: 'WHATSAPP', en: 'WhatsApp', ar: 'واتساب' },
  { code: 'PHONE', en: 'Phone', ar: 'هاتف' },
  { code: 'PRIVATE', en: 'Private', ar: 'خاص' },
  { code: 'FACEBOOK', en: 'Facebook', ar: 'فيسبوك' },
  { code: 'INSTAGRAM', en: 'Instagram', ar: 'إنستغرام' },
  { code: 'FOLLOW_UP', en: 'Follow up', ar: 'متابعة' },
];

export const DIRECT_CHANNEL = 'DIRECT';
/** Channels staff can pick for a manually-created (backend) order — excludes Direct. */
export const BACKEND_CHANNELS = CHANNELS.filter((c) => !c.storefrontOnly);

const BY_CODE = new Map(CHANNELS.map((c) => [c.code, c]));
export const channelLabel = (code: string | null | undefined, locale = 'en') => {
  if (!code) return '—';
  const c = BY_CODE.get(code);
  return c ? (locale === 'ar' ? c.ar : c.en) : code; // fall back to raw (legacy 'manual', WC source, etc.)
};
export const isChannel = (code: string | null | undefined) => !!code && BY_CODE.has(code);
