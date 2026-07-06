import Image from 'next/image';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { readCartId, getCart } from '@/lib/cart-service';
import { listAreas, deliverToOptions } from '@/lib/shipping-service';
import { getSetting } from '@/lib/settings-service';
import { updateCartQtyAction, removeFromCartAction } from '@/server/cart-actions';
import { formatEGP } from '@/lib/format';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { pick } from '@/lib/admin-i18n';

const monthYear = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
type SP = Record<string, string | string[] | undefined>;

const selectCls = 'w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3 py-2 text-sm text-ink';
const cardCls = 'rounded-[12px] border border-[color:var(--green-dark-05)] bg-white p-5 shadow-[var(--shadow-card)]';

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
  const addFailed = (Array.isArray(sp.add) ? sp.add[0] : sp.add) === 'out';
  const stockNotice = addFailed && (
    <div className="mb-6 rounded-[12px] border border-[color:var(--gold)] bg-gold-wash px-4 py-3 text-sm font-medium text-ink" role="alert">
      {t('outOfStock')}
    </div>
  );

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        {stockNotice}
        <h1 className="text-3xl font-bold text-green-dark">{t('emptyTitle')}</h1>
        <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-green-dark hover:text-lime-press">{t('browse')}</Link>
      </div>
    );
  }

  const tb = pick(locale);
  const subtotal = lines.reduce((s, l) => s + l.subtotalPiastres, 0);
  const hasPreorder = lines.some((l) => l.preorder);
  const depositPercent = Number(await getSetting('preorder.depositPercent')) || 25;
  const depositNow = Math.round((subtotal * depositPercent) / 100);
  const balanceLater = subtotal - depositNow;
  const areaId = (Array.isArray(sp.area) ? sp.area[0] : sp.area) ?? undefined;
  const [areas, deliver] = await Promise.all([listAreas(), deliverToOptions(areaId, locale)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {stockNotice}
      <h1 className="mb-6 text-3xl font-bold text-green-dark">{t('title')}</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-4">
          {lines.map((l) => (
            <li key={`${l.productId}:${l.condition}:${l.preorder ? 'P' : ''}`} className="flex gap-4 rounded-[12px] border border-[color:var(--green-dark-05)] bg-white p-4 shadow-[var(--shadow-card)]">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-[10px] bg-surface">
                <Image src={l.image} alt={l.name} fill sizes="80px" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col">
                <Link href={`/products/${l.slug}`} className="font-semibold text-ink hover:text-green-dark">{l.name}</Link>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {l.preorder ? (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gold-wash px-2.5 py-0.5 text-xs font-semibold text-gold-deep">
                      {tb('Pre-order', 'طلب مسبق')}
                    </span>
                  ) : (
                    <span className="inline-flex w-fit rounded-full bg-green-wash px-2.5 py-0.5 text-xs font-semibold text-green-dark">
                      {l.nearestExpiry ? t('exp', { date: monthYear(l.nearestExpiry) }) : t('noExpiry')}
                    </span>
                  )}
                  {isConditionVariant(l.condition) && (
                    <span className="inline-flex w-fit rounded-full bg-gold-wash px-2.5 py-0.5 text-xs font-semibold text-gold-deep">
                      {conditionLabel(l.condition, locale)}
                    </span>
                  )}
                </span>
                <div className="mt-auto flex items-center justify-between">
                  <form action={updateCartQtyAction} className="flex items-center gap-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="productId" value={l.productId} />
                    <input type="hidden" name="condition" value={l.condition} />
                    {l.preorder && <input type="hidden" name="preorder" value="1" />}
                    <input type="number" name="qty" min="0" defaultValue={l.qty} className="w-16 rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-2 py-1 text-sm text-ink" />
                    <button className="text-xs font-semibold text-green-dark hover:text-lime-press">{t('update')}</button>
                  </form>
                  <form action={removeFromCartAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="productId" value={l.productId} />
                    <input type="hidden" name="condition" value={l.condition} />
                    {l.preorder && <input type="hidden" name="preorder" value="1" />}
                    <button className="text-xs text-slate-45 hover:text-error">{t('remove')}</button>
                  </form>
                </div>
              </div>
              <div className="text-end font-bold text-green-dark">{formatEGP(l.subtotalPiastres)}</div>
            </li>
          ))}
        </ul>

        <aside className="space-y-5">
          <div className={cardCls}>
            <div className="flex justify-between text-sm">
              <span className="text-[color:var(--text-muted)]">{t('subtotal')}</span>
              <span className="font-bold text-ink">{formatEGP(subtotal)}</span>
            </div>
            {hasPreorder && (
              <div className="mt-3 space-y-1.5 rounded-[10px] bg-gold-wash p-3 text-[13px]">
                <div className="flex items-center gap-1.5 font-bold text-ink">
                  {tb('Includes a pre-order', 'يشمل طلبًا مسبقًا')}
                </div>
                <div className="flex justify-between text-[color:var(--text-muted)]">
                  <span>{tb(`Deposit now (${depositPercent}%, est.)`, `العربون الآن (${depositPercent}٪ تقديري)`)}</span>
                  <span className="font-semibold text-gold-deep">{formatEGP(depositNow)}</span>
                </div>
                <div className="flex justify-between text-[color:var(--text-muted)]">
                  <span>{tb('Balance on delivery', 'الباقي عند التوصيل')}</span>
                  <span className="font-semibold text-ink">{formatEGP(balanceLater)}</span>
                </div>
                <p className="pt-1 text-[11.5px] leading-snug text-[color:var(--text-subtle)]">
                  {tb('Pre-order items ship when back in stock; final deposit is calculated at checkout.', 'تُشحن منتجات الطلب المسبق عند توفّرها؛ يُحسب العربون النهائي عند الدفع.')}
                </p>
              </div>
            )}
            <Link href="/checkout" className="v-btn v-btn--primary v-btn--block mt-4">{t('proceed')}</Link>
          </div>

          <div className={cardCls}>
            <p className="mb-2 text-sm font-semibold text-ink">{t('deliverTo')}</p>
            <form className="mb-3">
              <select name="area" defaultValue={areaId ?? ''} className={selectCls}>
                <option value="">{t('selectArea')}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} · {a.zone.governorate}</option>
                ))}
              </select>
              <button className="v-btn v-btn--secondary v-btn--block v-btn--sm mt-2">{t('checkOptions')}</button>
            </form>
            <ul className="space-y-1.5 text-sm">
              {deliver.map((o) => (
                <li key={o.type} className="flex justify-between">
                  <span className="text-ink">{o.label} <span className="text-[color:var(--text-subtle)]">· {o.eta}</span></span>
                  <span className="font-semibold text-green-dark">{Number(o.feePiastres) === 0 ? t('free') : formatEGP(Number(o.feePiastres))}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
