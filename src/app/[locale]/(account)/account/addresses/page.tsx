import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auth } from '@/auth';
import { listAddresses } from '@/lib/address-service';
import { GOVERNORATES, governorateLabel } from '@/lib/governorates';
import { PhoneInput } from '@/components/ui/phone-input';
import { saveAddressAction, deleteAddressAction, setDefaultAddressAction } from '@/server/address-actions';

type SP = Record<string, string | string[] | undefined>;
const field = 'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';

export default async function AddressesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  const cid = session?.user?.customerId;
  if (!cid) redirect(`/${locale}/login`);

  const addresses = await listAddresses(cid);
  const t = await getTranslations('storefront.account.addresses');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/account" className="text-sm font-semibold text-green-dark hover:text-lime-press">← {t('back')}</Link>
      <h1 className="mt-2 text-3xl font-bold text-green-dark">{t('title')}</h1>

      {(Array.isArray(sp.saved) ? sp.saved[0] : sp.saved) === '1' && (
        <p className="mt-4 rounded-[8px] bg-green-wash px-3 py-2 text-sm text-green-dark">{t('saved')}</p>
      )}
      {(Array.isArray(sp.error) ? sp.error[0] : sp.error) === 'phone' && (
        <p role="alert" className="mt-4 rounded-[8px] bg-error-wash px-3 py-2 text-sm text-error">{t('errPhone')}</p>
      )}

      <div className="mt-6 space-y-3">
        {addresses.length === 0 && <p className="text-sm text-[color:var(--text-muted)]">{t('none')}</p>}
        {addresses.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-4 rounded-[12px] border border-[color:var(--green-dark-05)] bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="text-sm">
              <div className="font-semibold text-ink">
                {governorateLabel(a.governorate, locale)} · {a.city}{a.area ? ` · ${a.area}` : ''}
                {a.isDefaultShipping && <span className="ms-2 rounded-full bg-green-wash px-2 py-0.5 text-xs font-semibold text-green-dark">{t('defaultBadge')}</span>}
              </div>
              <div className="text-[color:var(--text-muted)]">{[a.street, a.building, a.phone].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {!a.isDefaultShipping && (
                <form action={setDefaultAddressAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={a.id} />
                  <button className="font-semibold text-green-dark hover:text-lime-press">{t('makeDefault')}</button>
                </form>
              )}
              <form action={deleteAddressAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={a.id} />
                <button className="text-slate-45 hover:text-error">{t('del')}</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <form action={saveAddressAction} className="mt-8 rounded-[12px] border border-[color:var(--green-dark-05)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 text-lg font-bold text-green-dark">{t('addNew')}</h2>
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">{t('governorate')}
            <select name="governorate" required defaultValue="" className={field}>
              <option value="" disabled>—</option>
              {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink">{t('city')}<input name="city" required className={field} /></label>
          <label className="block text-sm font-semibold text-ink">{t('phone')}<PhoneInput name="phone" inputClassName={field} /></label>
          <label className="block text-sm font-semibold text-ink sm:col-span-2">{t('street')}<input name="street" className={field} /></label>
          <label className="block text-sm font-semibold text-ink sm:col-span-2">{t('building')}<input name="building" className={field} /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="isDefaultShipping" className="size-4 accent-[color:var(--green-dark)]" /> {t('makeDefault')}</label>
        <button className="v-btn v-btn--primary mt-4">{t('save')}</button>
      </form>
    </div>
  );
}
