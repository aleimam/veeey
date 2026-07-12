'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createSpecialOrderRequestAction, type SpecialOrderFormState } from '@/server/special-order-actions';
import { ImageUploader } from '@/components/admin/image-uploader';
import { PHONE_PATTERN } from '@/lib/phone';

const field =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';

export function SpecialOrderForm({ locale, isLoggedIn, defaultName, defaultEmail }: { locale: string; isLoggedIn: boolean; defaultName?: string; defaultEmail?: string }) {
  const t = useTranslations('storefront.specialOrderForm');
  const [state, action] = useActionState<SpecialOrderFormState, FormData>(createSpecialOrderRequestAction, {});

  return (
    <form action={action} className="mt-6 max-w-xl space-y-4">
      {state.error && <p role="alert" className="rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error">{state.error === 'phone' ? t('errPhone') : t('error')}</p>}
      <input type="hidden" name="locale" value={locale} />

      <label className="block text-sm font-semibold text-ink">{t('product')}
        <input name="requestedProductText" required className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">{t('size')}
          <input name="size" placeholder={t('sizePlaceholder')} className={field} />
        </label>
        <label className="block text-sm font-semibold text-ink">{t('concentration')}
          <input name="concentration" placeholder={t('concentrationPlaceholder')} className={field} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">{t('productUrl')}
        <input name="productUrl" type="url" placeholder="https://…" className={field} />
      </label>

      {/* Contact — skipped for logged-in shoppers (taken from the account). */}
      {isLoggedIn ? (
        <p className="rounded-[8px] bg-green-wash px-3 py-2 text-sm text-green-dark">{t('loggedInContact', { name: defaultName ?? defaultEmail ?? '' })}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-ink">{t('name')}
              <input name="requesterName" required defaultValue={defaultName ?? ''} className={field} />
            </label>
            <label className="block text-sm font-semibold text-ink">{t('phone')}
              <input name="requesterPhone" required inputMode="tel" pattern={PHONE_PATTERN} title={t('phoneHint')} placeholder="01XXXXXXXXX" className={field} />
            </label>
          </div>
          <label className="block text-sm font-semibold text-ink">{t('email')}
            <input name="requesterEmail" type="email" defaultValue={defaultEmail ?? ''} className={field} />
          </label>
        </>
      )}

      <div>
        <p className="text-sm font-semibold text-ink">{t('photos')}</p>
        <p className="mb-1.5 text-xs text-[color:var(--text-muted)]">{t('photosHint')}</p>
        <ImageUploader name="photoUrls" endpoint="/api/special-order/upload" />
      </div>

      <label className="block text-sm font-semibold text-ink">{t('details')}
        <textarea name="notes" rows={3} className={field} />
      </label>

      <button type="submit" className="v-btn v-btn--primary">{t('submit')}</button>
    </form>
  );
}
