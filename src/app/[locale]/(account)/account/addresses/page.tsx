import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auth } from '@/auth';
import { listAddresses } from '@/lib/address-service';
import { GOVERNORATES, governorateLabel } from '@/lib/governorates';
import { saveAddressAction, deleteAddressAction, setDefaultAddressAction } from '@/server/address-actions';

type SP = Record<string, string | string[] | undefined>;
const field = 'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

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
      <Link href="/account" className="text-sm text-primary hover:underline">← {t('back')}</Link>
      <h1 className="mt-2 font-heading text-2xl font-semibold text-foreground">{t('title')}</h1>

      {(Array.isArray(sp.saved) ? sp.saved[0] : sp.saved) === '1' && (
        <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{t('saved')}</p>
      )}

      <div className="mt-6 space-y-3">
        {addresses.length === 0 && <p className="text-sm text-muted-foreground">{t('none')}</p>}
        {addresses.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
            <div className="text-sm">
              <div className="font-medium">
                {governorateLabel(a.governorate, locale)} · {a.city}{a.area ? ` · ${a.area}` : ''}
                {a.isDefaultShipping && <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t('defaultBadge')}</span>}
              </div>
              <div className="text-muted-foreground">{[a.street, a.building, a.phone].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {!a.isDefaultShipping && (
                <form action={setDefaultAddressAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-primary hover:underline">{t('makeDefault')}</button>
                </form>
              )}
              <form action={deleteAddressAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={a.id} />
                <button className="text-destructive hover:underline">{t('del')}</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <form action={saveAddressAction} className="mt-8 rounded-xl border border-border p-5">
        <h2 className="mb-3 font-heading text-lg font-semibold">{t('addNew')}</h2>
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">{t('governorate')}
            <select name="governorate" required defaultValue="" className={field}>
              <option value="" disabled>—</option>
              {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">{t('city')}<input name="city" required className={field} /></label>
          <label className="block text-sm font-medium">{t('phone')}<input name="phone" className={field} /></label>
          <label className="block text-sm font-medium sm:col-span-2">{t('street')}<input name="street" className={field} /></label>
          <label className="block text-sm font-medium sm:col-span-2">{t('building')}<input name="building" className={field} /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="isDefaultShipping" className="size-4" /> {t('makeDefault')}</label>
        <button className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{t('save')}</button>
      </form>
    </div>
  );
}
