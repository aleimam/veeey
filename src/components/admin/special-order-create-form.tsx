'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { createSpecialOrderAdminAction, type SpecialOrderFormState } from '@/server/special-order-actions';
import { inputCls, Field, FormError, SubmitButton } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export function SpecialOrderCreateForm({ locale }: { locale: string }) {
  const t = pick(useLocale());
  const [state, action] = useActionState<SpecialOrderFormState, FormData>(createSpecialOrderAdminAction, {});

  return (
    <form action={action} className="max-w-xl space-y-4">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />

      <Field label={t('Product', 'المنتج')}>
        <input name="requestedProductText" required className={inputCls} />
      </Field>
      <Field label={t('Product link', 'رابط المنتج')}>
        <input name="productUrl" type="url" placeholder="https://…" className={inputCls} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Requester name', 'اسم مقدّم الطلب')}>
          <input name="requesterName" required className={inputCls} />
        </Field>
        <Field label={t('Requester phone', 'هاتف مقدّم الطلب')}>
          <input name="requesterPhone" required className={inputCls} />
        </Field>
      </div>

      <Field label={t('Requester email', 'بريد مقدّم الطلب')}>
        <input name="requesterEmail" type="email" className={inputCls} />
      </Field>

      <Field
        label={t('Customer email (optional)', 'بريد العميل (اختياري)')}
        hint={t('Link this request to an existing customer account by email.', 'اربط هذا الطلب بحساب عميل موجود عبر البريد الإلكتروني.')}
      >
        <input name="customerEmail" type="email" className={inputCls} />
      </Field>

      <Field label={t('Notes', 'ملاحظات')}>
        <textarea name="notes" rows={3} className={inputCls} />
      </Field>

      <SubmitButton>{t('Create special order', 'إنشاء طلب خاص')}</SubmitButton>
    </form>
  );
}
