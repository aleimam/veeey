'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createSpecialOrderRequestAction, type SpecialOrderFormState } from '@/server/special-order-actions';

const field = 'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function SpecialOrderForm({ locale, defaultName, defaultEmail }: { locale: string; defaultName?: string; defaultEmail?: string }) {
  const t = useTranslations('storefront.specialOrderForm');
  const [state, action] = useActionState<SpecialOrderFormState, FormData>(createSpecialOrderRequestAction, {});

  return (
    <form action={action} className="mt-6 max-w-xl space-y-4">
      {state.error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{t('error')}</p>}
      <input type="hidden" name="locale" value={locale} />

      <label className="block text-sm font-medium">{t('product')}
        <input name="requestedProductText" required className={field} />
      </label>
      <label className="block text-sm font-medium">{t('productUrl')}
        <input name="productUrl" type="url" placeholder="https://…" className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">{t('name')}
          <input name="requesterName" required defaultValue={defaultName ?? ''} className={field} />
        </label>
        <label className="block text-sm font-medium">{t('phone')}
          <input name="requesterPhone" required className={field} />
        </label>
      </div>
      <label className="block text-sm font-medium">{t('email')}
        <input name="requesterEmail" type="email" defaultValue={defaultEmail ?? ''} className={field} />
      </label>
      <label className="block text-sm font-medium">{t('notes')}
        <textarea name="notes" rows={3} className={field} />
      </label>

      <button type="submit" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">{t('submit')}</button>
    </form>
  );
}
