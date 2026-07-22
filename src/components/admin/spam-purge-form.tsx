'use client';

import { useLocale } from 'next-intl';
import { deleteSpamCustomersAction } from '@/server/customer-admin-actions';
import { pick } from '@/lib/admin-i18n';

/** Delete-form for the suspected-fake-accounts screen. Deletion is permanent,
 *  so it asks for the number of ticked rows to be typed back — the same guard
 *  the bulk tools use — and refuses to submit an empty selection. */
export function SpamPurgeForm({ locale, children }: { locale: string; children: React.ReactNode }) {
  const tb = pick(useLocale());
  return (
    <form
      action={deleteSpamCustomersAction}
      onSubmit={(e) => {
        const form = e.currentTarget;
        const count = form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length;
        if (count === 0) {
          e.preventDefault();
          alert(tb('Tick the accounts you want to delete first.', 'حدد الحسابات المراد حذفها أولًا.'));
          return;
        }
        const typed = prompt(tb(
          `Permanently delete ${count} account(s)? This cannot be undone. Type ${count} to confirm.`,
          `حذف ${count} حساب نهائيًا؟ لا يمكن التراجع. اكتب ${count} للتأكيد.`,
        ));
        if (typed?.trim() !== String(count)) e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      {children}
    </form>
  );
}

/** Ticks/unticks every deletable row in the form. */
export function SelectAllSpam({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4"
        onChange={(e) => {
          const form = e.currentTarget.closest('form');
          form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => { box.checked = e.currentTarget.checked; });
        }}
      />
      {label}
    </label>
  );
}
