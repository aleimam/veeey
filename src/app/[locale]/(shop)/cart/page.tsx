import Image from 'next/image';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { readCartId, getCart } from '@/lib/cart-service';
import { listAreas, deliverToOptions } from '@/lib/shipping-service';
import { updateCartQtyAction, removeFromCartAction } from '@/server/cart-actions';
import { formatEGP } from '@/lib/format';

const monthYear = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
type SP = Record<string, string | string[] | undefined>;

export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('storefront.cart');
  const cartId = await readCartId();
  const lines = cartId ? await getCart(cartId, locale) : [];

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-heading text-2xl font-semibold text-foreground">{t('emptyTitle')}</h1>
        <Link href="/products" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">{t('browse')}</Link>
      </div>
    );
  }

  const subtotal = lines.reduce((s, l) => s + l.subtotalPiastres, 0);
  const areaId = (Array.isArray(sp.area) ? sp.area[0] : sp.area) ?? undefined;
  const [areas, deliver] = await Promise.all([listAreas(), deliverToOptions(areaId, locale)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">{t('title')}</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-4">
          {lines.map((l) => (
            <li key={l.productId} className="flex gap-4 rounded-xl border border-border p-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface">
                <Image src={l.image} alt={l.name} fill sizes="80px" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col">
                <Link href={`/products/${l.slug}`} className="font-medium text-foreground hover:text-primary">{l.name}</Link>
                <span className="mt-1 inline-flex w-fit rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{l.nearestExpiry ? t('exp', { date: monthYear(l.nearestExpiry) }) : t('noExpiry')}</span>
                <div className="mt-auto flex items-center justify-between">
                  <form action={updateCartQtyAction} className="flex items-center gap-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="productId" value={l.productId} />
                    <input type="number" name="qty" min="0" defaultValue={l.qty} className="w-16 rounded-md border border-border bg-card px-2 py-1 text-sm" />
                    <button className="text-xs text-primary hover:underline">{t('update')}</button>
                  </form>
                  <form action={removeFromCartAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="productId" value={l.productId} />
                    <button className="text-xs text-muted-foreground hover:text-destructive">{t('remove')}</button>
                  </form>
                </div>
              </div>
              <div className="text-end font-semibold text-foreground">{formatEGP(l.subtotalPiastres)}</div>
            </li>
          ))}
        </ul>

        <aside className="space-y-5">
          <div className="rounded-xl border border-border p-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('subtotal')}</span>
              <span className="font-semibold text-foreground">{formatEGP(subtotal)}</span>
            </div>
            <Link href="/checkout" className="mt-4 block rounded-xl bg-primary px-4 py-2.5 text-center font-medium text-primary-foreground hover:opacity-90">
              {t('proceed')}
            </Link>
          </div>

          <div className="rounded-xl border border-border p-5">
            <p className="mb-2 text-sm font-medium text-foreground">{t('deliverTo')}</p>
            <form className="mb-3">
              <select name="area" defaultValue={areaId ?? ''} className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm">
                <option value="">{t('selectArea')}</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.zone.governorate}</option>)}
              </select>
              <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{t('checkOptions')}</button>
            </form>
            <ul className="space-y-1 text-sm">
              {deliver.map((o) => (
                <li key={o.type} className="flex justify-between">
                  <span>{o.label} <span className="text-muted-foreground">· {o.eta}</span></span>
                  <span className="font-medium">{Number(o.feePiastres) === 0 ? t('free') : formatEGP(Number(o.feePiastres))}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
