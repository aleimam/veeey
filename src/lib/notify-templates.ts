/**
 * Notification templates (FR-NOT-01). Pure {{var}} interpolation + the seeded
 * default set (admin-editable in the DB — never hard-code business copy beyond
 * these starter defaults). Unit-tested.
 */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : ''));
}

export type SeedTemplate = { key: string; channel: 'EMAIL' | 'PUSH' | 'SMS' | 'WHATSAPP'; locale: string; subject?: string; body: string };

export const SEED_TEMPLATES: SeedTemplate[] = [
  { key: 'order.placed', channel: 'EMAIL', locale: 'en', subject: 'Order {{number}} received', body: 'Hi {{name}}, we received your order {{number}} ({{total}} EGP). We will keep you posted.' },
  { key: 'order.shipped', channel: 'EMAIL', locale: 'en', subject: 'Order {{number}} is on its way', body: 'Good news {{name}} — order {{number}} has shipped. Tracking: {{tracking}}.' },
  { key: 'order.delivered', channel: 'EMAIL', locale: 'en', subject: 'Order {{number}} delivered', body: 'Your order {{number}} was delivered. Enjoy — and you have earned loyalty points!' },
  { key: 'alert.price_drop', channel: 'PUSH', locale: 'en', subject: 'Price drop', body: '{{product}} just dropped to {{price}} EGP.' },
  { key: 'alert.back_in_stock', channel: 'PUSH', locale: 'en', subject: 'Back in stock', body: '{{product}} is back in stock.' },
  // SMS order lifecycle (short — sent when SMS is configured + a phone is on the order).
  { key: 'order.placed', channel: 'SMS', locale: 'en', body: 'Veeey: we received order {{number}} ({{total}} EGP). Thank you!' },
  { key: 'order.placed', channel: 'SMS', locale: 'ar', body: 'Veeey: استلمنا طلبك {{number}} ({{total}} ج.م). شكرًا لك!' },
  { key: 'order.shipped', channel: 'SMS', locale: 'en', body: 'Veeey: order {{number}} shipped. Tracking: {{tracking}}.' },
  { key: 'order.shipped', channel: 'SMS', locale: 'ar', body: 'Veeey: تم شحن طلبك {{number}}. رقم التتبّع: {{tracking}}.' },
  { key: 'order.delivered', channel: 'SMS', locale: 'en', body: 'Veeey: order {{number}} delivered. Enjoy — loyalty points added!' },
  { key: 'order.delivered', channel: 'SMS', locale: 'ar', body: 'Veeey: تم تسليم طلبك {{number}}. استمتع — وأُضيفت نقاط الولاء!' },
  // WhatsApp order confirmation (sent when the WhatsApp provider is configured).
  { key: 'order.placed', channel: 'WHATSAPP', locale: 'en', body: 'Hi {{name}} 👋 Thank you for your Veeey order {{number}} ({{total}} EGP). We are preparing it and will keep you posted right here.' },
  { key: 'order.placed', channel: 'WHATSAPP', locale: 'ar', body: 'أهلًا {{name}} 👋 شكرًا لطلبك من فيي {{number}} ({{total}} ج.م). نجهّزه الآن وسنوافيك بالتحديثات هنا.' },
  { key: 'order.shipped', channel: 'WHATSAPP', locale: 'en', body: 'Veeey: good news {{name}} — order {{number}} has shipped 🚚 Tracking: {{tracking}}.' },
  { key: 'order.shipped', channel: 'WHATSAPP', locale: 'ar', body: 'فيي: خبر سار يا {{name}} — تم شحن طلبك {{number}} 🚚 رقم التتبّع: {{tracking}}.' },
];
