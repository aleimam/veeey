'use client';

import { useLocale } from 'next-intl';
import { startMediaLocalizeAction } from '@/server/go-live-actions';
import { pick } from '@/lib/admin-i18n';

/** "Localize images now" — starts the background job that downloads every
 *  remote catalog image to our own /uploads storage (confirmed first; dead
 *  URLs are pruned so products fall back to the placeholder). */
export function MediaLocalizeButton({ locale, remote }: { locale: string; remote: number }) {
  const tb = pick(useLocale());
  return (
    <form
      action={startMediaLocalizeAction}
      onSubmit={(e) => {
        if (remote === 0) { e.preventDefault(); return; }
        if (!confirm(tb(
          `Download ${remote} remote image(s) to Veeey's own storage? The job runs in the background (can take a while); dead source URLs are removed so those products show as "missing image" instead of broken.`,
          `تنزيل ${remote} صورة خارجية إلى تخزين Veeey الخاص؟ تعمل المهمة في الخلفية (قد تستغرق وقتًا)؛ الروابط الميتة تُحذف فتظهر تلك المنتجات ضمن «بدون صورة» بدلًا من صور مكسورة.`,
        ))) e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <button disabled={remote === 0} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {remote === 0 ? tb('All images are local ✓', 'كل الصور محلية ✓') : tb(`Localize ${remote} image(s) now`, `توطين ${remote} صورة الآن`)}
      </button>
    </form>
  );
}
