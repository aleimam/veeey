'use client';

import { useActionState } from 'react';
import { Link } from '@/i18n/navigation';
import { saveTierAction } from '@/server/tier-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';

type Defaults = {
  key?: string;
  nameEn?: string;
  nameAr?: string;
  rank?: number;
  earnRatePerEgp?: number;
  color?: string | null;
  badge?: string | null;
};

/** Create/edit a loyalty tier (FR-PRC-03). */
export function TierForm({ id, locale, defaults = {} }: { id?: string; locale: string; defaults?: Defaults }) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveTierAction, {});

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      <Field label="الاسم (بالإنجليزية)">
        <input name="nameEn" required defaultValue={defaults.nameEn ?? ''} className={inputCls} />
      </Field>
      <Field label="الاسم (بالعربية)">
        <input name="nameAr" required dir="rtl" defaultValue={defaults.nameAr ?? ''} className={inputCls} />
      </Field>
      <Field label="الكود" hint="معرّف ثابت، مثل GREEN / VEEEYIP / SELECT.">
        <input name="key" required defaultValue={defaults.key ?? ''} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="الرتبة" hint="1 = الفئة الأساسية؛ كلما زاد الرقم زادت الميزات.">
          <input name="rank" type="number" min={1} required defaultValue={defaults.rank ?? 1} className={inputCls} />
        </Field>
        <Field label="النقاط لكل ج.م" hint="معدّل اكتساب النقاط لهذه الفئة.">
          <input name="earnRatePerEgp" type="number" min={0} required defaultValue={defaults.earnRatePerEgp ?? 1} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="اللون" hint="قيمة Hex، تُستخدم لشارة الفئة.">
          <input name="color" type="text" placeholder="#48884D" defaultValue={defaults.color ?? ''} className={inputCls} />
        </Field>
        <Field label="الشارة" hint="تسمية أو رمز اختياري.">
          <input name="badge" type="text" defaultValue={defaults.badge ?? ''} className={inputCls} />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>حفظ الفئة</SubmitButton>
        <Link href="/admin/tiers" className="text-sm text-muted-foreground hover:underline">إلغاء</Link>
      </div>
    </form>
  );
}
