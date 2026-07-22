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
  { key: 'alert.price_drop', channel: 'PUSH', locale: 'ar', subject: 'انخفاض في السعر', body: 'انخفض سعر {{product}} إلى {{price}} ج.م.' },
  { key: 'alert.back_in_stock', channel: 'PUSH', locale: 'en', subject: 'Back in stock', body: '{{product}} is back in stock.' },
  { key: 'alert.back_in_stock', channel: 'PUSH', locale: 'ar', subject: 'عاد للمخزون', body: '{{product}} أصبح متوفرًا من جديد.' },
  // Wishlist alerts by email (needs SMTP; gated by alerts.wishlistEmailEnabled).
  { key: 'alert.price_drop', channel: 'EMAIL', locale: 'en', subject: 'Price drop on your wishlist: {{product}}', body: 'Good news — {{product}} on your wishlist just dropped to {{price}} EGP. Grab it before it goes back up: {{link}}' },
  { key: 'alert.price_drop', channel: 'EMAIL', locale: 'ar', subject: 'انخفاض سعر منتج في قائمة أمنياتك: {{product}}', body: 'خبر سار — انخفض سعر {{product}} في قائمة أمنياتك إلى {{price}} ج.م. اطلبه قبل أن يعود السعر للارتفاع: {{link}}' },
  { key: 'alert.back_in_stock', channel: 'EMAIL', locale: 'en', subject: 'Back in stock: {{product}}', body: '{{product}} from your wishlist is back in stock. Stock moves fast — order here: {{link}}' },
  { key: 'alert.back_in_stock', channel: 'EMAIL', locale: 'ar', subject: 'عاد للمخزون: {{product}}', body: '{{product}} من قائمة أمنياتك أصبح متوفرًا من جديد. الكمية محدودة — اطلب من هنا: {{link}}' },
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
  // Post-delivery review request (#188) — sent N days after an order is delivered.
  { key: 'review.request', channel: 'EMAIL', locale: 'en', subject: 'How did you like your order {{number}}?', body: 'Hi {{name}}, thanks for shopping with Veeey! Your recent order included: {{products}}. Would you share a quick review? It only takes a minute and helps other shoppers choose. Review here: {{link}}' },
  { key: 'review.request', channel: 'EMAIL', locale: 'ar', subject: 'ما رأيك في طلبك {{number}}؟', body: 'مرحبًا {{name}}، شكرًا لتسوّقك من فيي! تضمّن طلبك الأخير: {{products}}. هل تشاركنا تقييمًا سريعًا؟ لا يستغرق سوى دقيقة، ويساعد بقية المتسوّقين على الاختيار. قيّم من هنا: {{link}}' },
  // Guest→account creation (checkout backlog P2) — set-password link email.
  { key: 'account.setPassword', channel: 'EMAIL', locale: 'en', subject: 'Welcome to Veeey — set your password', body: 'Hi {{name}}, your Veeey account is ready and your order details are saved to it. Choose a password to finish setting it up (link valid for 7 days): {{link}}' },
  { key: 'account.setPassword', channel: 'EMAIL', locale: 'ar', subject: 'أهلًا بك في فيي — عيّن كلمة المرور', body: 'مرحبًا {{name}}، حسابك في فيي جاهز وتفاصيل طلبك محفوظة فيه. اختر كلمة مرور لإكمال إعداده (الرابط صالح لمدة ٧ أيام): {{link}}' },
  // Abandoned-cart reminder (#185) — one email when a signed-in cart sits idle.
  { key: 'cart.abandoned', channel: 'EMAIL', locale: 'en', subject: 'You left {{count}} item(s) in your Veeey cart', body: 'Hi {{name}}, you still have {{count}} item(s) waiting in your cart ({{total}} EGP). Pick up where you left off: {{link}}' },
  { key: 'cart.abandoned', channel: 'EMAIL', locale: 'ar', subject: 'تركت {{count}} منتجًا في سلة فيي', body: 'مرحبًا {{name}}، ما زال لديك {{count}} منتجًا في سلّتك ({{total}} ج.م). أكمل من حيث توقّفت: {{link}}' },
];
