/**
 * Notification templates (FR-NOT-01). Pure {{var}} interpolation + the seeded
 * default set (admin-editable in the DB — never hard-code business copy beyond
 * these starter defaults). Unit-tested.
 */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : ''));
}

export type SeedTemplate = { key: string; channel: 'EMAIL' | 'PUSH'; locale: string; subject?: string; body: string };

export const SEED_TEMPLATES: SeedTemplate[] = [
  { key: 'order.placed', channel: 'EMAIL', locale: 'en', subject: 'Order {{number}} received', body: 'Hi {{name}}, we received your order {{number}} ({{total}} EGP). We will keep you posted.' },
  { key: 'order.shipped', channel: 'EMAIL', locale: 'en', subject: 'Order {{number}} is on its way', body: 'Good news {{name}} — order {{number}} has shipped. Tracking: {{tracking}}.' },
  { key: 'order.delivered', channel: 'EMAIL', locale: 'en', subject: 'Order {{number}} delivered', body: 'Your order {{number}} was delivered. Enjoy — and you have earned loyalty points!' },
  { key: 'alert.price_drop', channel: 'PUSH', locale: 'en', subject: 'Price drop', body: '{{product}} just dropped to {{price}} EGP.' },
  { key: 'alert.back_in_stock', channel: 'PUSH', locale: 'en', subject: 'Back in stock', body: '{{product}} is back in stock.' },
];
