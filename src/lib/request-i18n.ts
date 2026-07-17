import type { Pick } from '@/lib/admin-i18n';
import { REQUEST_TYPES, REQUEST_STATUSES } from '@/lib/request-logic';

/**
 * Bilingual labels + short descriptions for request types and statuses, shared
 * by the /admin/requests list, form and detail. Mirrors YeldnIN's reqtype/
 * reqstatus strings. Type order = purchasing priority (SPECIAL_ORDER first).
 */

export function requestTypeLabel(t: Pick, type: string): string {
  switch (type) {
    case 'SPECIAL_ORDER': return t('Special order', 'طلب خاص');
    case 'OUT_OF_STOCK': return t('Out of stock', 'نفد من المخزون');
    case 'RESTOCK': return t('Restock', 'إعادة تخزين');
    case 'OPTIONAL': return t('Optional', 'اختياري');
    default: return type;
  }
}

export function requestTypeHint(t: Pick, type: string): string {
  switch (type) {
    case 'SPECIAL_ORDER': return t('Customer-driven (includes pre-orders).', 'مدفوع من العميل (يشمل الطلبات المسبقة).');
    case 'OUT_OF_STOCK': return t('Default for out-of-stock or last-piece products.', 'افتراضي للمنتجات النافدة أو آخر قطعة.');
    case 'RESTOCK': return t('Fast-moving or low-stock products.', 'منتجات سريعة الحركة أو منخفضة المخزون.');
    case 'OPTIONAL': return t('Always-needed products, refilled monthly.', 'منتجات مطلوبة دائمًا، تُجدَّد شهريًا.');
    default: return '';
  }
}

export function requestStatusLabel(t: Pick, status: string): string {
  switch (status) {
    case 'PENDING': return t('Pending', 'قيد المراجعة');
    case 'APPROVED': return t('Approved', 'مُعتمد');
    case 'REJECTED': return t('Rejected', 'مرفوض');
    default: return status;
  }
}

export const REQUEST_TYPE_OPTIONS = REQUEST_TYPES;
export const REQUEST_STATUS_OPTIONS = REQUEST_STATUSES;
