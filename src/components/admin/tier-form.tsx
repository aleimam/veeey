'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveTierAction } from '@/server/tier-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

type Defaults = {
  key?: string;
  nameEn?: string;
  nameAr?: string;
  rank?: number;
  earnRatePerEgp?: number;
  minSpendEgp?: number;
  color?: string | null;
  badge?: string | null;
};

/** Create/edit a loyalty tier (FR-PRC-03). */
export function TierForm({ id, locale, defaults = {} }: { id?: string; locale: string; defaults?: Defaults }) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveTierAction, {});
  const tb = pick(useLocale());

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      <Field label={tb('Name (English)', 'الاسم (بالإنجليزية)')}>
        <input name="nameEn" required defaultValue={defaults.nameEn ?? ''} className={inputCls} />
      </Field>
      <Field label={tb('Name (Arabic)', 'الاسم (بالعربية)')}>
        <input name="nameAr" required dir="rtl" defaultValue={defaults.nameAr ?? ''} className={inputCls} />
      </Field>
      <Field label={tb('Key', 'الكود')} hint={tb('Stable identifier, e.g. GREEN / VEEEYIP / SELECT.', 'معرّف ثابت، مثل GREEN / VEEEYIP / SELECT.')}>
        <input name="key" required defaultValue={defaults.key ?? ''} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={tb('Rank', 'الرتبة')} hint={tb('1 = base tier; higher number means more perks.', '1 = الفئة الأساسية؛ كلما زاد الرقم زادت الميزات.')}>
          <input name="rank" type="number" min={1} required defaultValue={defaults.rank ?? 1} className={inputCls} />
        </Field>
        <Field label={tb('Points per EGP', 'النقاط لكل ج.م')} hint={tb('Points earn rate for this tier.', 'معدّل اكتساب النقاط لهذه الفئة.')}>
          <input name="earnRatePerEgp" type="number" min={0} required defaultValue={defaults.earnRatePerEgp ?? 1} className={inputCls} />
        </Field>
      </div>
      <Field
        label={tb('Min lifetime spend (EGP)', 'الحد الأدنى للإنفاق الكلي (ج.م)')}
        hint={tb('Customers are auto-promoted to the highest tier whose threshold their delivered-order spend meets. 0 = base tier.', 'يُرقّى العملاء تلقائيًا لأعلى فئة يحقق إنفاقهم (الطلبات المُسلّمة) حدّها. 0 = الفئة الأساسية.')}
      >
        <input name="minSpendEgp" type="number" min={0} step="0.01" required defaultValue={defaults.minSpendEgp ?? 0} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={tb('Color', 'اللون')} hint={tb('Hex value, used for the tier badge.', 'قيمة Hex، تُستخدم لشارة الفئة.')}>
          <input name="color" type="text" placeholder="#48884D" defaultValue={defaults.color ?? ''} className={inputCls} />
        </Field>
        <Field label={tb('Badge', 'الشارة')} hint={tb('Optional label or symbol.', 'تسمية أو رمز اختياري.')}>
          <input name="badge" type="text" defaultValue={defaults.badge ?? ''} className={inputCls} />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{tb('Save tier', 'حفظ الفئة')}</SubmitButton>
        <Link href="/admin/tiers" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
