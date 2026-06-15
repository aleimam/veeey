/**
 * Notification preference resolution (FR-NOT-03). A notification is allowed only
 * if both the channel master switch and the category switch are on. Pure +
 * unit-tested.
 */
export type NotifyType = 'ORDER' | 'PRICE_DROP' | 'BACK_IN_STOCK' | 'MARKETING';
export type NotifyChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
export type Prefs = { email: boolean; push: boolean; orderUpdates: boolean; priceDrop: boolean; backInStock: boolean; marketing: boolean };

export const DEFAULT_PREFS: Prefs = { email: true, push: true, orderUpdates: true, priceDrop: true, backInStock: true, marketing: false };

export function channelAllowed(prefs: Prefs, type: NotifyType, channel: NotifyChannel): boolean {
  if (channel === 'EMAIL' && !prefs.email) return false;
  if (channel === 'PUSH' && !prefs.push) return false;
  switch (type) {
    case 'ORDER': return prefs.orderUpdates;
    case 'PRICE_DROP': return prefs.priceDrop;
    case 'BACK_IN_STOCK': return prefs.backInStock;
    case 'MARKETING': return prefs.marketing;
  }
}
