'use client';

import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

export const inputCls =
  'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
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
  insufficient_stock: 'Not enough stock for one of the products. Reduce the quantity or check inventory.',
};

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {ERRORS[error] ?? error}
    </p>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'PUBLISHED'
      ? 'bg-primary/10 text-primary'
      : status === 'ARCHIVED'
        ? 'bg-muted text-muted-foreground'
        : 'bg-gold/15 text-slate';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}
