import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { getOrder } from '@/lib/order-service';
import { listGifts } from '@/lib/gift-service';
import { listProducts } from '@/lib/catalog-service';
import { listStatusConfigs } from '@/lib/order-status-service';
import { formatEGP } from '@/lib/format';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import { aramexConfigured, smsaConfigured } from '@/lib/provider-config';
import { listSystemMethods, customerLabel } from '@/lib/payment-method-service';
import { CHANNELS } from '@/lib/channels';
import { pick } from '@/lib/admin-i18n';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { deriveSourceKey, sourceLabel, attributionDetail, type Attribution } from '@/lib/attribution';
import { ChangeHistory } from '@/components/admin/change-history';
import {
  transitionOrderAction, assignPharmacistAction, setPayCheckAction, setSystemPaymentMethodAction, setOrderMetaAction,
  setTrackingAction, addOrderItemAction, removeOrderItemAction, addGiftToOrderAction, markOrderItemLostAction,
} from '@/server/order-actions';
import { createAramexShipmentAction, trackAramexAction, createSmsaShipmentAction, trackSmsaAction } from '@/server/carrier-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const monthYear = (d: Date | null) => (d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : '—');

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<SP> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const order = await getOrder(id);
  if (!order) notFound();

  const [staff, gifts, products, aramexOn, smsaOn, systemMethods, statusCfgs] = await Promise.all([
    prisma.user.findMany({ where: { roleId: { not: null } }, select: { id: true, name: true, email: true } }),
    listGifts(),
    listProducts(),
    aramexConfigured(),
    smsaConfigured(),
    listSystemMethods(),
    listStatusConfigs(),
  ]);
  const shipErr = one(sp.shiperr);
  const shipOk = one(sp.shipok) === '1';
  const labelUrl = one(sp.label);
  const trackMsg = one(sp.track);
  const editable = (['HOLD', 'EDIT', 'CONFIRMED', 'PENDING'] as string[]).includes(order.status);
  const statusByCode = new Map<string, (typeof statusCfgs)[number]>(statusCfgs.map((c) => [c.code, c]));
  const statusLabelOf = (code: string) => { const c = statusByCode.get(code); return c ? (locale === 'ar' ? c.labelAr : c.labelEn) : code.replaceAll('_', ' '); };
  const transitions = (statusByCode.get(order.status)?.allowedNext ?? []) as string[];
  const hidden = (extra: Record<string, string>) =>
    Object.entries({ locale, id, ...extra }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.customer?.user.email ?? order.guestEmail ?? tb('Guest', 'زائر')} · {order.placedAt.toISOString().slice(0, 10)} · {tb('Risk', 'المخاطرة')} {order.riskScore ?? 0} · <StatusBadge status={order.status} />
          </p>
        </div>
        <a href={`/api/admin/orders/${order.id}/invoice`} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('Print invoice (PDF)', 'طباعة الفاتورة (PDF)')}</a>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items + edit-in-Hold */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">{tb('Items', 'العناصر')}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr><th className="p-2 text-start">{tb('Product', 'المنتج')}</th><th className="p-2">{tb('Expiry', 'الصلاحية')}</th><th className="p-2">{tb('Weight', 'الوزن')}</th><th className="p-2">{tb('Qty', 'الكمية')}</th><th className="p-2">{tb('Total', 'الإجمالي')}</th><th className="p-2" /></tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className={`border-t border-border ${it.lost ? 'opacity-60' : ''}`}>
                    <td className={`p-2 ${it.lost ? 'line-through' : ''}`}>{it.product.nameEn} <span className="text-muted-foreground">({it.product.sku})</span>{it.lost && <span className="ms-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive no-underline">{tb('Lost', 'مفقود')}</span>}</td>
                    <td className="p-2 text-center">
                      {it.preorder ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">{tb('Pre-order', 'طلب مسبق')}</span> : monthYear(it.lineExpiry)}
                      {isConditionVariant(it.condition) && <span className="ms-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">{conditionLabel(it.condition, locale)}</span>}
                    </td>
                    <td className="p-2 text-center">{it.product.weightG != null ? `${it.product.weightG}g` : '—'}</td>
                    <td className="p-2 text-center">{it.qty}</td>
                    <td className={`p-2 text-center ${it.lost ? 'line-through' : ''}`}>{formatEGP(Number(it.unitPricePiastres) * it.qty)}</td>
                    <td className="p-2 text-end">
                      <div className="flex items-center justify-end gap-3">
                        <form action={markOrderItemLostAction}>{hidden({ orderItemId: it.id, lost: it.lost ? '0' : '1' })}<button className="text-xs text-muted-foreground hover:underline">{it.lost ? tb('Restore', 'استرجاع') : tb('Mark lost', 'تحديد كمفقود')}</button></form>
                        {editable && !it.lost && (
                          <form action={removeOrderItemAction}>{hidden({ orderItemId: it.id })}<button className="text-xs text-destructive hover:underline">{tb('Remove', 'إزالة')}</button></form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {order.gifts.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">🎁 {tb('Internal gifts (hidden from customer)', 'هدايا داخلية (مخفية عن العميل)')}: {order.gifts.map((g) => `${g.gift.code}×${g.qty}`).join(', ')}</p>
          )}
          <div className="mt-2 text-end text-sm">
            <span className="text-muted-foreground">{tb('Total', 'الإجمالي')} </span><span className="font-semibold">{formatEGP(Number(order.totalPiastres))}</span>
          </div>
          {order.isPreorder && (
            <div className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-end text-xs text-amber-900">
              {tb('Pre-order', 'طلب مسبق')} · {tb('Deposit', 'العربون')} {formatEGP(Number(order.depositPaidPiastres ?? 0n))} · {tb('Balance on delivery', 'الباقي عند التوصيل')} {formatEGP(Number(order.balanceDuePiastres ?? 0n))}
            </div>
          )}

          {editable && (
            <form action={addOrderItemAction} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
              {hidden({})}
              <span className="w-full text-xs font-medium uppercase text-muted-foreground">{tb('Edit during hold — add item', 'التعديل أثناء الانتظار — إضافة عنصر')}</span>
              <select name="productId" className={`${inputCls} w-64`} required>
                <option value="">{tb('— Product —', '— المنتج —')}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.nameEn} ({p.sku})</option>)}
              </select>
              <input type="number" name="qty" min="1" defaultValue={1} className={`${inputCls} w-20`} />
              <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{tb('Add (FEFO)', 'إضافة (FEFO)')}</button>
            </form>
          )}
        </section>

        {/* Controls */}
        <aside className="space-y-5 text-sm">
          <div className="rounded-lg border border-border p-4">
            <p className="mb-2 font-medium">{tb('Status', 'الحالة')}</p>
            <div className="flex flex-wrap gap-2">
              {transitions.length === 0 && <span className="text-xs text-muted-foreground">{tb('Final status.', 'حالة نهائية.')}</span>}
              {transitions.map((t) => (
                <form key={t} action={transitionOrderAction}>{hidden({ status: t })}<button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">{statusLabelOf(t)}</button></form>
              ))}
            </div>
          </div>

          <form action={assignPharmacistAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-2 font-medium">{tb('Pharmacist', 'الصيدلي')}</p>
            <select name="pharmacistId" defaultValue={order.pharmacist?.id ?? ''} className={inputCls}>
              <option value="">{tb('— Unassigned —', '— غير معيَّن —')}</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name ?? s.email}</option>)}
            </select>
            <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Assign', 'تعيين')}</button>
          </form>

          <form action={setPayCheckAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-2 font-medium">{tb('Payment check', 'مراجعة الدفع')}</p>
            <select name="payCheck" defaultValue={order.payCheck} className={inputCls}>
              {['NO', 'YES', 'PROBLEM'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Save', 'حفظ')}</button>
          </form>

          <form action={setSystemPaymentMethodAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-1 font-medium">{tb('Payment method', 'طريقة الدفع')}</p>
            <p className="mb-2 text-xs text-muted-foreground">{tb('Customer chose', 'اختار العميل')}: <span className="text-foreground">{customerLabel(order.paymentMethod, locale)}</span></p>
            <label className="text-xs text-muted-foreground">{tb('System method (invoice)', 'طريقة النظام (الفاتورة)')}
              <select name="systemPaymentMethod" defaultValue={order.systemPaymentMethod ?? ''} className={`${inputCls} mt-1`}>
                <option value="">{tb('— auto / unset —', '— تلقائي / غير محدد —')}</option>
                {systemMethods.map((m) => <option key={m.id} value={m.code}>{locale === 'ar' ? m.labelAr || m.labelEn : m.labelEn}</option>)}
              </select>
            </label>
            <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Save', 'حفظ')}</button>
          </form>

          <form action={setTrackingAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-2 font-medium">{tb('Tracking → Shipped', 'التتبع → تم الشحن')}</p>
            <input name="trackingNumber" placeholder={tb('Waybill number', 'رقم بوليصة الشحن')} defaultValue={order.trackingNumber ?? ''} className={inputCls} />
            <select name="courier" defaultValue={order.courier ?? ''} className={`${inputCls} mt-2`}>
              <option value="">{tb('— Courier —', '— شركة الشحن —')}</option>
              {['ARAMEX', 'SMSA', 'OWN'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">{tb('Add tracking', 'إضافة تتبع')}</button>
          </form>

          {aramexOn && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 font-medium">{tb('Aramex', 'Aramex')}</p>
              {shipOk && <p className="mb-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">{tb('Shipment created.', 'تم إنشاء الشحنة.')}</p>}
              {shipErr && <p className="mb-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{tb('Aramex error: ', 'خطأ Aramex: ')}{shipErr}</p>}
              {trackMsg && <p className="mb-2 rounded-md bg-gold/15 px-2 py-1 text-xs text-slate">{tb('Status: ', 'الحالة: ')}{trackMsg}</p>}
              {order.courier === 'ARAMEX' && order.trackingNumber ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{tb('AWB', 'بوليصة الشحن')}: <span className="font-medium text-foreground">{order.trackingNumber}</span></p>
                  {labelUrl && <a href={labelUrl} target="_blank" rel="noreferrer" className="block rounded-md border border-border px-3 py-1.5 text-center text-sm hover:bg-surface">{tb('Print label', 'طباعة الملصق')}</a>}
                  <form action={trackAramexAction}>
                    {hidden({ awb: order.trackingNumber })}
                    <button className="w-full rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{tb('Refresh tracking', 'تحديث التتبع')}</button>
                  </form>
                </div>
              ) : (
                <form action={createAramexShipmentAction}>
                  {hidden({})}
                  <button className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('Create Aramex shipment', 'إنشاء شحنة Aramex')}</button>
                </form>
              )}
            </div>
          )}

          {smsaOn && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 font-medium">{tb('SMSA', 'SMSA')}</p>
              {order.courier === 'SMSA' && order.trackingNumber ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{tb('AWB', 'بوليصة الشحن')}: <span className="font-medium text-foreground">{order.trackingNumber}</span></p>
                  <a href={`/api/admin/carriers/smsa-label?awb=${encodeURIComponent(order.trackingNumber)}`} target="_blank" rel="noreferrer" className="block rounded-md border border-border px-3 py-1.5 text-center text-sm hover:bg-surface">{tb('Print label', 'طباعة الملصق')}</a>
                  <form action={trackSmsaAction}>
                    {hidden({ awb: order.trackingNumber })}
                    <button className="w-full rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{tb('Refresh tracking', 'تحديث التتبع')}</button>
                  </form>
                </div>
              ) : (
                <form action={createSmsaShipmentAction}>
                  {hidden({})}
                  <button className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('Create SMSA shipment', 'إنشاء شحنة SMSA')}</button>
                </form>
              )}
            </div>
          )}

          <form action={setOrderMetaAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-2 font-medium">{tb('Metadata', 'البيانات الوصفية')}</p>
            <select name="customerOrderType" defaultValue={order.customerOrderType ?? ''} className={inputCls}>
              <option value="">{tb('Customer type…', 'نوع العميل…')}</option>
              {['DISCOUNT_CHASER', 'DOCTOR_RECOMMENDED', 'SALES_ADVICE', 'SELF_ORDERING'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select name="orderProductType" defaultValue={order.orderProductType ?? ''} className={`${inputCls} mt-2`}>
              <option value="">{tb('Product type…', 'نوع المنتج…')}</option>
              {['MISCELLANEOUS', 'MALE_SUPPORT', 'PREMIUM', 'NEW', 'TREND'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select name="source" defaultValue={order.source ?? ''} className={`${inputCls} mt-2`}>
              <option value="">{tb('Channel…', 'القناة…')}</option>
              {CHANNELS.map((c) => <option key={c.code} value={c.code}>{locale === 'ar' ? c.ar : c.en}</option>)}
            </select>
            <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Save', 'حفظ')}</button>
            {/* Automatic traffic attribution (read-only) — lives alongside the manual Channel. */}
            <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{tb('Traffic source', 'مصدر الزيارة')}: </span>
              {sourceLabel(deriveSourceKey(order.utmJson as Attribution | null), locale)}
              {attributionDetail(order.utmJson as Attribution | null) && (
                <span className="block truncate" title={attributionDetail(order.utmJson as Attribution | null)}>
                  {attributionDetail(order.utmJson as Attribution | null)}
                </span>
              )}
            </div>
          </form>

          {gifts.length > 0 && (
            <form action={addGiftToOrderAction} className="rounded-lg border border-border p-4">
              {hidden({})}
              <p className="mb-2 font-medium">{tb('Add gift (hidden)', 'إضافة هدية (مخفية)')}</p>
              <select name="giftId" className={inputCls}>
                {gifts.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.internalName} ({tb('Stock', 'المخزون')} {g.stock})</option>)}
              </select>
              <input type="number" name="qty" min="1" defaultValue={1} className={`${inputCls} mt-2`} />
              <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Add gift', 'إضافة هدية')}</button>
            </form>
          )}
        </aside>
      </div>

      <ChangeHistory entityType="Order" entityId={order.id} locale={locale} />
    </div>
  );
}
