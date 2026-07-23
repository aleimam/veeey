'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';

type Action = (prev: AdminFormState, fd: FormData) => Promise<AdminFormState>;
type Defaults = { code?: string; internalName?: string; nameEn?: string; nameAr?: string; stock?: string; expiry?: string; costEgp?: string };

/**
 * Gift create/edit form. Grouped card layout, and a "Non-perishable" checkbox
 * that bypasses the expiry date (default ON — most gifts don't expire). A
 * disabled expiry input isn't submitted, so non-perishable saves a null expiry.
 */
export function GiftForm({ action, defaults = {}, id, locale, listHref, labels }: {
  action: Action;
  defaults?: Defaults;
  id?: string;
  locale: string;
  listHref: string;
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(action, {});
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  // Non-perishable = no expiry. Default ON, and ON for any existing gift that has
  // no expiry set — so most gifts never touch the date field.
  const [nonPerishable, setNonPerishable] = useState(!defaults.expiry);
  const [expiry, setExpiry] = useState(defaults.expiry ?? '');
  const L = (k: string) => labels[k] ?? k;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const cancel = () => { if (dirty && !confirm(tc('unsavedLeave'))) return; router.push(listHref); };
  const card = 'space-y-4 rounded-xl border border-border bg-card p-5';

  return (
    <form action={formAction} onChange={() => setDirty(true)} className="max-w-3xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      <section className={card}>
        <h2 className="text-sm font-semibold text-foreground">{L('detailsHeading')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L('code')} required><input type="text" name="code" defaultValue={defaults.code ?? ''} required className={inputCls} /></Field>
          <Field label={L('internalName')} required><input type="text" name="internalName" defaultValue={defaults.internalName ?? ''} required className={inputCls} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L('nameEn')} hint={L('nameHint')}><input type="text" name="nameEn" defaultValue={defaults.nameEn ?? ''} className={inputCls} /></Field>
          <Field label={L('nameAr')}><input type="text" name="nameAr" dir="rtl" defaultValue={defaults.nameAr ?? ''} className={inputCls} /></Field>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-foreground">{L('stockHeading')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L('stock')}><input type="number" name="stock" min="0" defaultValue={defaults.stock ?? '0'} className={inputCls} /></Field>
          <Field label={L('cost')}><input type="number" name="costEgp" step="0.01" min="0" defaultValue={defaults.costEgp ?? ''} className={inputCls} /></Field>
        </div>
        <Field label={L('expiry')}>
          <label className="mb-2 flex items-center gap-2 text-sm font-normal text-muted-foreground">
            <input type="checkbox" checked={nonPerishable} onChange={(e) => { setNonPerishable(e.target.checked); setDirty(true); if (e.target.checked) setExpiry(''); }} className="size-4" />
            {L('nonPerishable')}
          </label>
          <input
            type="date"
            name="expiry"
            value={nonPerishable ? '' : expiry}
            disabled={nonPerishable}
            onChange={(e) => setExpiry(e.target.value)}
            aria-label={L('expiry')}
            className={`${inputCls} ${nonPerishable ? 'cursor-not-allowed opacity-50' : ''}`}
          />
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <button type="button" onClick={cancel} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface">{tc('cancel')}</button>
      </div>
    </form>
  );
}
