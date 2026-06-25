'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createSpecialOrderRequestAction, type SpecialOrderFormState } from '@/server/special-order-actions';

const field =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';

export function SpecialOrderForm({ locale, defaultName, defaultEmail }: { locale: string; defaultName?: string; defaultEmail?: string }) {
  const t = useTranslations('storefront.specialOrderForm');
  const [state, action] = useActionState<SpecialOrderFormState, FormData>(createSpecialOrderRequestAction, {});

  return (
    <form action={action} className="mt-6 max-w-xl space-y-4">
      {state.error && <p role="alert" className="rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error">{t('error')}</p>}
      <input type="hidden" name="locale" value={locale} />

      <label className="block text-sm font-semibold text-ink">{t('product')}
        <input name="requestedProductText" required className={field} />
      </label>
      <label className="block text-sm font-semibold text-ink">{t('productUrl')}
        <input name="productUrl" type="url" placeholder="https://…" className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">{t('name')}
          <input name="requesterName" required defaultValue={defaultName ?? ''} className={field} />
        </label>
        <label className="block text-sm font-semibold text-ink">{t('phone')}
          <input name="requesterPhone" required className={field} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">{t('email')}
        <input name="requesterEmail" type="email" defaultValue={defaultEmail ?? ''} className={field} />
      </label>
      <label className="block text-sm font-semibold text-ink">{t('notes')}
        <textarea name="notes" rows={3} className={field} />
      </label>

      <button type="submit" className="v-btn v-btn--primary">{t('submit')}</button>
    </form>
  );
}
