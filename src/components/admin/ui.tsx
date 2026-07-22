'use client';

import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

export const inputCls =
  'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  /** V7 audit C9: show a visible marker. The * is decoration for sighted users
   *  (aria-hidden) — screen readers get "required" from the input's own
   *  `required` attribute, so pass BOTH or the two audiences see different forms. */
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      {required && <span aria-hidden className="text-destructive"> *</span>}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ children }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  const t = useTranslations('admin.common');
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
    >
      {pending ? `${t('save')}…` : (children ?? t('save'))}
    </button>
  );
}

const ERRORS: Record<string, string> = {
  invalid: 'Please check the fields and try again.',
  forbidden: 'You don’t have permission to do that.',
  exists: 'An account with this email already exists.',
  self: 'You can’t change your own access here.',
  no_items: 'Add at least one product line.',
  bad_phone: 'That phone number is not valid — check the country code and the number.',
  insufficient_stock: 'Not enough stock for one of the products. Reduce the quantity or check inventory.',
  gift_stock: 'Not enough gift stock for one of the selected gifts. Reduce the quantity or restock the gift.',
};

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {ERRORS[error] ?? error}
    </p>
  );
}

const SUCCESS = new Set(['PUBLISHED', 'CONFIRMED', 'CASH_DELIVERED', 'CARD_DELIVERED', 'DELIVERED', 'COMPLETED', 'ACTIVE', 'APPROVED', 'PAID', 'FULFILLED', 'LIVE']);
const WARN = new Set(['PENDING_CONFIRMATION', 'PENDING', 'PROCESSING', 'HOLD', 'ON_HOLD', 'REQUESTED', 'DRAFT', 'AWAITING_PAYMENT', 'QUARANTINE']);
const DANGER = new Set(['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'REFUNDED', 'RETURNED', 'EXPIRED', 'WRITTEN_OFF']);
const INFO = new Set(['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PRIVATE', 'SUBMITTED', 'SOURCING']);

export function StatusBadge({ status }: { status: string }) {
  const tone = SUCCESS.has(status)
    ? 'bg-primary/10 text-primary'
    : DANGER.has(status)
      ? 'bg-destructive/10 text-destructive'
      : WARN.has(status)
        ? 'bg-gold/15 text-slate'
        : INFO.has(status)
          ? 'bg-[color:var(--info-wash)] text-[color:var(--info)]'
          : 'bg-muted text-muted-foreground';
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>{status.replaceAll('_', ' ').toLowerCase()}</span>;
}
