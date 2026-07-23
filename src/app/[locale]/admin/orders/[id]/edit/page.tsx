import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getOrder } from '@/lib/order-service';
import { StatusTimeline } from '@/components/orders/status-timeline';
import { prisma } from '@/lib/prisma';
import { listGifts } from '@/lib/gift-service';
import { listStatusConfigs } from '@/lib/order-status-service';
import { getNumberSetting } from '@/lib/settings-service';
import { salesStaff } from '@/lib/department-service';
import { listShippingTypes } from '@/lib/shipping-service';
import { paidBalance } from '@/lib/order-money';
import { formatEGP } from '@/lib/format';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import { aramexConfigured, smsaConfigured } from '@/lib/provider-config';
import { listSystemMethods, customerLabel } from '@/lib/payment-method-service';
import { CHANNELS } from '@/lib/channels';
import { SHOPPING_STYLES, PRODUCTS_TYPES } from '@/lib/order-traits';
import { pick } from '@/lib/admin-i18n';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { deriveSourceKey, sourceLabel, attributionDetail, type Attribution } from '@/lib/attribution';
import { ChangeHistory } from '@/components/admin/change-history';
import { ProductLinePicker } from '@/components/admin/order-item-picker';
import {
  transitionOrderAction, refundPaymentAction, addOrderItemAction, removeOrderItemAction,
  addGiftToOrderAction, removeGiftFromOrderAction, markOrderItemLostAction, saveOrderEditAction,
} from '@/server/order-actions';
import { createAramexShipmentAction, trackAramexAction, createSmsaShipmentAction, trackSmsaAction, createVeeeyExpressShipmentAction } from '@/server/carrier-actions';
import { createOrderRequestAction } from '@/server/request-actions';
import { requestTypeLabel } from '@/lib/request-i18n';
import { requirePermission } from '@/lib/auth-guards';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const monthYear = (d: Date | null) => (d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : '—');

export default async function OrderEditPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (matches the sidebar's permission key). The individual form
  // actions enforce the finer write/fulfill grants + open-order editability.
  await requirePermission('orders.read');
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const order = await getOrder(id);
  if (!order) notFound();

  const [staff, gifts, aramexOn, smsaOn, systemMethods, statusCfgs, depositPercent, shippingTypes] = await Promise.all([
    salesStaff(), // pharmacist/handler picker = Sales department members (TEAM epic)
    listGifts(),
    aramexConfigured(),
    smsaConfigured(),
    listSystemMethods(),
    listStatusConfigs(),
    getNumberSetting('preorder.depositPercent'),
    listShippingTypes(),
  ]);
  const editErr = one(sp.editerr);
  const saved = one(sp.saved) === '1';
  const egp = (p: bigint | number) => (Number(p) / 100).toFixed(2); // for prefilling edit inputs
  const paidDelta = order.paymentState === 'PAID' ? paidBalance(order.totalPiastres, order.paidAmountPiastres) : 0n;
  // Unified ship flow: `ship` = the courier chosen in the chooser → shows its
  // review/edit step. `shipped` = an AWB already exists (show its details).
  const shipChoice = one(sp.ship);
  const shipped = !!(order.courier && order.trackingNumber);
  const shipAddr = (order.shippingAddressJson ?? {}) as { name?: string; phone?: string; governorate?: string; city?: string; area?: string; street?: string };
  const codDefault = order.paymentMethod === 'COD' ? egp(order.totalPiastres) : '0';
  const shipErr = one(sp.shiperr);
  const shipOk = one(sp.shipok) === '1';
  const labelUrl = one(sp.label);
  const trackMsg = one(sp.track);
  const editable = (['HOLD', 'EDIT', 'CONFIRMED', 'PENDING'] as string[]).includes(order.status);
  const statusByCode = new Map<string, (typeof statusCfgs)[number]>(statusCfgs.map((c) => [c.code, c]));
  const statusLabelOf = (code: string) => { const c = statusByCode.get(code); return c ? (locale === 'ar' ? c.labelAr : c.labelEn) : code.replaceAll('_', ' '); };
  const transitions = (statusByCode.get(order.status)?.allowedNext ?? []) as string[];

  // Resolve staff names for the status timeline (actorId → name), one query.
  const actorIds = [...new Set(order.statusHistory.map((h) => h.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const timelineEntries = order.statusHistory.map((h) => ({
    fromStatus: h.fromStatus, toStatus: h.toStatus, note: h.note, createdAt: h.createdAt,
    actorName: h.actorId ? (actorName.get(h.actorId) ?? tb('Staff', 'موظف')) : tb('System', 'النظام'),
  }));
  const hidden = (extra: Record<string, string>) =>
    Object.entries({ locale, id, ...extra }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className="p-6">
      <Link href={`/admin/orders/${order.id}`} className="text-sm text-primary hover:underline">← {tb('Back to order', 'العودة إلى الطلب')}</Link>
      <header className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{tb('Edit', 'تعديل')} · {order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.customerId ? (
              <Link href={`/admin/customers/${order.customerId}`} className="font-medium text-primary hover:underline">{order.customer?.user.email || tb('Customer', 'العميل')}</Link>
            ) : (
              order.guestEmail ?? tb('Guest', 'زائر')
            )} · {order.placedAt.toISOString().slice(0, 10)} · {tb('Risk', 'المخاطرة')} {order.riskScore ?? 0} · <StatusBadge status={order.status} />
          </p>
        </div>
        <a href={`/api/admin/orders/${order.id}/invoice?lang=${locale}`} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('Print invoice (PDF)', 'طباعة الفاتورة (PDF)')}</a>
      </header>

      {saved && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Changes saved.', 'تم حفظ التغييرات.')}</div>}
      {editErr === 'locked' && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{tb('This order is closed. Move it back to an open status (e.g. Confirmed) before editing its items or pricing.', 'هذا الطلب مغلق. أعِده إلى حالة مفتوحة (مثل «مؤكد») قبل تعديل عناصره أو أسعاره.')}</div>
      )}
      {editErr === 'invalid' && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save that change — please check the value.', 'تعذّر حفظ التغيير — يرجى التحقق من القيمة.')}</div>
      )}
      {order.paymentState === 'PAID' && paidDelta !== 0n && (
        <div className="mb-4 rounded-lg bg-gold/15 px-3 py-2 text-sm text-slate">
          {paidDelta > 0n
            ? tb(`This paid order's total is now ${formatEGP(Number(order.totalPiastres))}, but ${formatEGP(Number(order.paidAmountPiastres ?? 0n))} was collected — balance owed ${formatEGP(Number(paidDelta))}.`,
                 `إجمالي هذا الطلب المدفوع أصبح ${formatEGP(Number(order.totalPiastres))}، لكن المُحصّل ${formatEGP(Number(order.paidAmountPiastres ?? 0n))} — المتبقّي ${formatEGP(Number(paidDelta))}.`)
            : tb(`This paid order's total dropped to ${formatEGP(Number(order.totalPiastres))}; ${formatEGP(Number(order.paidAmountPiastres ?? 0n))} was collected — overpaid ${formatEGP(Number(-paidDelta))} (refund may be due).`,
                 `انخفض إجمالي هذا الطلب المدفوع إلى ${formatEGP(Number(order.totalPiastres))}؛ المُحصّل ${formatEGP(Number(order.paidAmountPiastres ?? 0n))} — زيادة ${formatEGP(Number(-paidDelta))} (قد يلزم ردّها).`)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items — per-line price inputs belong to the combined #orderEditForm below */}
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
                    <td className={`p-2 text-center ${it.lost ? 'line-through' : ''}`}>
                      {editable && !it.lost ? (
                        <div className="flex flex-col items-center gap-1">
                          <span>{formatEGP(Number(it.unitPricePiastres) * it.qty)}</span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            {tb('unit', 'وحدة')}
                            <input form="orderEditForm" name={`price_${it.id}`} type="number" step="0.01" min="0" defaultValue={egp(it.unitPricePiastres)} aria-label={tb('Unit price EGP', 'سعر الوحدة ج.م')} className="w-20 rounded border border-border px-1 py-0.5 text-end text-xs" />
                          </span>
                        </div>
                      ) : (
                        formatEGP(Number(it.unitPricePiastres) * it.qty)
                      )}
                    </td>
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
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>🎁 {tb('Internal gifts (hidden from customer)', 'هدايا داخلية (مخفية عن العميل)')}:</p>
              {order.gifts.map((g) => (
                <div key={g.id} className="flex items-center gap-2 ps-5">
                  <span>{g.gift.code} · {g.gift.internalName} × {g.qty}</span>
                  {editable && (
                    <form action={removeGiftFromOrderAction}>
                      {hidden({ orderGiftId: g.id })}
                      <button className="text-destructive hover:underline">{tb('Remove & restock', 'إزالة وإرجاع للمخزون')}</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 ms-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>{tb('Subtotal', 'المجموع الفرعي')}</span><span>{formatEGP(Number(order.subtotalPiastres))}</span></div>
            {Number(order.discountPiastres) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>{tb('Coupon discount', 'خصم الكوبون')}</span><span>− {formatEGP(Number(order.discountPiastres))}</span></div>
            )}
            {Number(order.manualDiscountPiastres) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{order.manualDiscountTitle || tb('Discount', 'خصم')}{order.manualDiscountPct ? ` (${order.manualDiscountPct}%)` : ''}</span>
                <span>− {formatEGP(Number(order.manualDiscountPiastres))}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>{tb('Shipping', 'الشحن')}{order.shippingFeeManual ? ` · ${tb('manual', 'يدوي')}` : ''}</span>
              <span>{Number(order.shippingPiastres) === 0 ? tb('Free', 'مجاني') : formatEGP(Number(order.shippingPiastres))}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground"><span>{tb('Total', 'الإجمالي')}</span><span>{formatEGP(Number(order.totalPiastres))}</span></div>
          </div>
          {order.isPreorder && (
            <div className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-end text-xs text-amber-900">
              {tb('Pre-order', 'طلب مسبق')} · {tb('Deposit', 'العربون')} {formatEGP(Number(order.depositPaidPiastres ?? 0n))} · {tb('Balance on delivery', 'الباقي عند التوصيل')} {formatEGP(Number(order.balanceDuePiastres ?? 0n))}
            </div>
          )}

          {editable && (
            <form action={addOrderItemAction} className="mt-4 space-y-2 rounded-lg border border-dashed border-border p-3">
              {hidden({})}
              <span className="block text-xs font-medium uppercase text-muted-foreground">{tb('Edit during hold — add item', 'التعديل أثناء الانتظار — إضافة عنصر')}</span>
              <ProductLinePicker depositPercent={depositPercent} />
              <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{tb('Add item', 'إضافة عنصر')}</button>
            </form>
          )}
        </section>

        {/* Controls */}
        <aside className="space-y-5 text-sm">
          {/* Status — an action, not a saved field */}
          <div className="rounded-lg border border-border p-4">
            <p className="mb-2 font-medium">{tb('Status', 'الحالة')}</p>
            <div className="flex flex-wrap gap-2">
              {transitions.length === 0 && <span className="text-xs text-muted-foreground">{tb('Final status.', 'حالة نهائية.')}</span>}
              {transitions.map((t) => (
                <form key={t} action={transitionOrderAction}>{hidden({ status: t })}<button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">{statusLabelOf(t)}</button></form>
              ))}
            </div>
            {order.paymentState === 'PAID' && (
              <form action={refundPaymentAction} className="mt-3 border-t border-border pt-3">
                {hidden({})}
                <button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">{tb('Mark payment refunded', 'تسجيل رد المبلغ')}</button>
              </form>
            )}
            {order.paymentState === 'REFUNDED' && (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{tb('Payment refunded.', 'تم رد المبلغ.')}</p>
            )}
          </div>

          <StatusTimeline entries={timelineEntries} locale={locale} showActor />

          {(order.isPreorder || order.isSpecialOrder || order.requests.length > 0) && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-1 font-medium">{tb('Purchasing request', 'طلب الشراء')}</p>
              <p className="mb-3 text-xs text-muted-foreground">{tb('Place a supplier purchasing request for this pre-order / special order.', 'أنشئ طلب شراء من المورّد لهذا الطلب المسبق / الخاص.')}</p>
              {order.requests.length > 0 ? (
                <ul className="mb-3 space-y-1.5">
                  {order.requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <Link href={`/admin/requests/${r.id}`} className="font-mono text-primary hover:underline">{r.uid ?? r.id.slice(0, 8)}</Link>
                      <span className="text-muted-foreground">{requestTypeLabel(tb, r.type)}</span>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-xs text-muted-foreground">{tb('No purchasing request placed yet.', 'لم يُنشأ طلب شراء بعد.')}</p>
              )}
              {one(sp.reqerr) && <p className="mb-2 text-xs text-destructive">{tb('Could not place the request.', 'تعذّر إنشاء الطلب.')}</p>}
              <form action={createOrderRequestAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="orderId" value={order.id} />
                <button className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                  {order.requests.length > 0 ? tb('Place another request', 'إنشاء طلب آخر') : tb('Place purchasing request', 'إنشاء طلب شراء')}
                </button>
              </form>
            </div>
          )}

          {/* ===== Combined "Save changes" form: every field edit commits together ===== */}
          <form id="orderEditForm" action={saveOrderEditAction} className="space-y-5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={id} />

            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 font-medium">{tb('Pharmacist', 'الصيدلي')}</p>
              <select name="pharmacistId" defaultValue={order.pharmacist?.id ?? ''} className={inputCls}>
                <option value="">{tb('— Unassigned —', '— غير معيَّن —')}</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name ?? s.email}</option>)}
              </select>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="font-medium">{tb('Payment', 'الدفع')}</p>
              <p className="text-xs text-muted-foreground">{tb('Customer chose', 'اختار العميل')}: <span className="text-foreground">{customerLabel(order.paymentMethod, locale)}</span></p>
              <label className="block text-xs text-muted-foreground">{tb('Payment check', 'مراجعة الدفع')}
                <select name="payCheck" defaultValue={order.payCheck} className={`${inputCls} mt-1`}>
                  {['NO', 'YES', 'PROBLEM'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">{tb('System method (invoice)', 'طريقة النظام (الفاتورة)')}
                <select name="systemPaymentMethod" defaultValue={order.systemPaymentMethod ?? ''} className={`${inputCls} mt-1`}>
                  <option value="">{tb('— auto / unset —', '— تلقائي / غير محدد —')}</option>
                  {systemMethods.map((m) => <option key={m.id} value={m.code}>{locale === 'ar' ? m.labelAr || m.labelEn : m.labelEn}</option>)}
                </select>
              </label>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="font-medium">{tb('Shopping & source', 'الشراء والمصدر')}</p>
              <label className="block text-xs text-muted-foreground">{tb('Shopping Style', 'أسلوب الشراء')}
                <select name="customerOrderType" defaultValue={order.customerOrderType ?? ''} className={`${inputCls} mt-1`}>
                  <option value="">{tb('— none —', '— بدون —')}</option>
                  {SHOPPING_STYLES.map((s) => <option key={s.value} value={s.value}>{locale === 'ar' ? s.ar : s.en}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">{tb('Products type', 'نوع المنتجات')}
                <select name="orderProductType" defaultValue={order.orderProductType ?? ''} className={`${inputCls} mt-1`}>
                  <option value="">{tb('— none —', '— بدون —')}</option>
                  {PRODUCTS_TYPES.map((p) => <option key={p.value} value={p.value}>{locale === 'ar' ? p.ar : p.en}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">{tb('Order Source', 'مصدر الطلب')}
                <select name="source" defaultValue={order.source ?? ''} className={`${inputCls} mt-1`}>
                  <option value="">{tb('— channel —', '— القناة —')}</option>
                  {CHANNELS.map((c) => <option key={c.code} value={c.code}>{locale === 'ar' ? c.ar : c.en}</option>)}
                </select>
              </label>
              {order.customerId && <p className="text-[11px] text-muted-foreground">{tb('Shopping Style & Products type also update this customer.', 'يُحدِّث «أسلوب الشراء» و«نوع المنتجات» هذا العميل أيضًا.')}</p>}
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{tb('Traffic source', 'مصدر الزيارة')}: </span>
                {sourceLabel(deriveSourceKey(order.utmJson as Attribution | null), locale)}
                {attributionDetail(order.utmJson as Attribution | null) && (
                  <span className="block truncate" title={attributionDetail(order.utmJson as Attribution | null)}>{attributionDetail(order.utmJson as Attribution | null)}</span>
                )}
              </div>
            </div>

            {editable ? (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="font-medium">{tb('Pricing & discount', 'الأسعار والخصم')}</p>
                <label className="block text-xs text-muted-foreground">{tb('Shipping method', 'طريقة الشحن')}
                  <select name="shippingType" defaultValue={order.shippingType ?? ''} className={`${inputCls} mt-1`}>
                    <option value="">{tb('— method —', '— الطريقة —')}</option>
                    {shippingTypes.map((s) => <option key={s.type} value={s.type}>{(locale === 'ar' ? s.labelAr : s.labelEn)} · {formatEGP(Number(s.feePiastres))}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-muted-foreground">{tb('Shipping fee (EGP)', 'رسوم الشحن (ج.م)')}
                  <input name="shippingFeeEgp" type="number" step="0.01" min="0" defaultValue={egp(order.shippingPiastres)} className={`${inputCls} mt-1`} />
                </label>
                <div className="space-y-2 border-t border-border pt-3">
                  <label className="block text-xs text-muted-foreground">{tb('Special discount', 'خصم خاص')}</label>
                  <input name="discountTitle" defaultValue={order.manualDiscountTitle ?? ''} placeholder={tb('Reason / title', 'السبب / العنوان')} className={inputCls} />
                  <select name="discountMode" defaultValue={order.manualDiscountPct != null ? 'pct' : (Number(order.manualDiscountPiastres) > 0 ? 'value' : 'pct')} className={inputCls}>
                    <option value="pct">{tb('Percentage %', 'نسبة مئوية %')}</option>
                    <option value="value">{tb('Fixed value (EGP)', 'قيمة ثابتة (ج.م)')}</option>
                    <option value="clear">{tb('Remove discount', 'إزالة الخصم')}</option>
                  </select>
                  <div className="flex gap-2">
                    <input name="discountPct" type="number" min="0" max="100" defaultValue={order.manualDiscountPct ?? ''} placeholder="%" aria-label={tb('Percent', 'نسبة')} className={inputCls} />
                    <input name="discountValueEgp" type="number" step="0.01" min="0" defaultValue={Number(order.manualDiscountPiastres) > 0 && order.manualDiscountPct == null ? egp(order.manualDiscountPiastres) : ''} placeholder={tb('EGP', 'ج.م')} aria-label={tb('Value EGP', 'قيمة ج.م')} className={inputCls} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{tb('Pick Percentage or Fixed value; the other box is ignored. Stacks on top of any coupon.', 'اختر النسبة أو القيمة الثابتة؛ يُتجاهل الحقل الآخر. يُضاف فوق أي كوبون.')}</p>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-border p-4 text-xs text-muted-foreground">{tb('Prices, shipping and discount are locked. Reopen the order (e.g. Confirmed) to edit them.', 'الأسعار والشحن والخصم مقفلة. أعِد فتح الطلب (مثل «مؤكد») لتعديلها.')}</p>
            )}

            <button className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">{tb('Save changes', 'حفظ التغييرات')}</button>
          </form>
          {/* ===== end combined form ===== */}

          {/* Shipping — Veeey Express (our own courier) is one click: the AWB is
              created by YeldnIN Ops, so nothing is typed here. Aramex/SMSA route to
              a review step where the AWB is edited before it's created. */}
          <div className="rounded-lg border border-border p-4">
            <p className="mb-2 font-medium">{tb('Shipping', 'الشحن')}</p>
            {shipOk && <p className="mb-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">{tb('Shipment created.', 'تم إنشاء الشحنة.')}</p>}
            {shipErr && <p className="mb-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{tb('Courier error: ', 'خطأ الشحن: ')}{shipErr}</p>}
            {trackMsg && <p className="mb-2 rounded-md bg-gold/15 px-2 py-1 text-xs text-slate">{tb('Status: ', 'الحالة: ')}{trackMsg}</p>}

            {shipped ? (
              <div className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">{tb('Courier', 'شركة الشحن')}: <span className="font-medium text-foreground">{order.courier === 'OWN' ? tb('Veeey Express', 'فيي إكسبريس') : order.courier}</span></p>
                <p className="text-xs text-muted-foreground">{order.courier === 'OWN' ? tb('Reference', 'المرجع') : tb('AWB', 'بوليصة الشحن')}: <span className="font-medium text-foreground">{order.trackingNumber}</span></p>
                {order.courier === 'ARAMEX' && labelUrl && <a href={labelUrl} target="_blank" rel="noreferrer" className="block rounded-md border border-border px-3 py-1.5 text-center hover:bg-surface">{tb('Print label', 'طباعة الملصق')}</a>}
                {order.courier === 'SMSA' && <a href={`/api/admin/carriers/smsa-label?awb=${encodeURIComponent(order.trackingNumber!)}`} target="_blank" rel="noreferrer" className="block rounded-md border border-border px-3 py-1.5 text-center hover:bg-surface">{tb('Print label', 'طباعة الملصق')}</a>}
                {order.courier === 'ARAMEX' && <form action={trackAramexAction}>{hidden({ awb: order.trackingNumber! })}<button className="w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Refresh tracking', 'تحديث التتبع')}</button></form>}
                {order.courier === 'SMSA' && <form action={trackSmsaAction}>{hidden({ awb: order.trackingNumber! })}<button className="w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Refresh tracking', 'تحديث التتبع')}</button></form>}
                {order.courier === 'OWN' && <p className="text-xs text-muted-foreground">{tb('Handed to YeldnIN — the assigned courier’s name and phone appear here once Ops assign one.', 'تم التسليم إلى YeldnIN — يظهر اسم وهاتف المندوب هنا بعد تعيينه.')}</p>}
              </div>
            ) : shipChoice === 'aramex' || shipChoice === 'smsa' ? (
              <form action={shipChoice === 'aramex' ? createAramexShipmentAction : createSmsaShipmentAction} className="space-y-2 text-sm">
                {hidden({})}
                <p className="text-xs text-muted-foreground">{tb('Review & edit before creating the', 'راجع وعدّل قبل إنشاء بوليصة')} {shipChoice === 'aramex' ? 'Aramex' : 'SMSA'} {tb('waybill:', 'الشحن:')}</p>
                <input name="awbName" defaultValue={shipAddr.name ?? ''} placeholder={tb('Recipient name', 'اسم المستلم')} aria-label={tb('Recipient name', 'اسم المستلم')} className={inputCls} />
                <input name="awbPhone" defaultValue={shipAddr.phone ?? ''} placeholder={tb('Phone', 'الهاتف')} aria-label={tb('Phone', 'الهاتف')} className={inputCls} />
                <div className="flex gap-2">
                  <input name="awbGovernorate" defaultValue={shipAddr.governorate ?? ''} placeholder={tb('Governorate', 'المحافظة')} aria-label={tb('Governorate', 'المحافظة')} className={inputCls} />
                  <input name="awbCity" defaultValue={shipAddr.city ?? ''} placeholder={tb('City', 'المدينة')} aria-label={tb('City', 'المدينة')} className={inputCls} />
                </div>
                <input name="awbArea" defaultValue={shipAddr.area ?? ''} placeholder={tb('Area', 'المنطقة')} aria-label={tb('Area', 'المنطقة')} className={inputCls} />
                <input name="awbStreet" defaultValue={shipAddr.street ?? ''} placeholder={tb('Street / building', 'الشارع / المبنى')} aria-label={tb('Street', 'الشارع')} className={inputCls} />
                <div className="flex gap-2">
                  <input name="awbPieces" type="number" min="1" defaultValue="1" placeholder={tb('Pieces', 'الطرود')} aria-label={tb('Pieces', 'الطرود')} className={inputCls} />
                  <input name="awbWeightKg" type="number" step="0.1" min="0" defaultValue="1" placeholder={tb('Weight (kg)', 'الوزن (كجم)')} aria-label={tb('Weight (kg)', 'الوزن (كجم)')} className={inputCls} />
                </div>
                <input name="awbContents" defaultValue={tb('Health products', 'منتجات صحية')} placeholder={tb('Contents', 'المحتويات')} aria-label={tb('Contents', 'المحتويات')} className={inputCls} />
                <input name="awbCod" type="number" step="0.01" min="0" defaultValue={codDefault} placeholder={tb('COD amount (EGP)', 'قيمة الدفع عند الاستلام (ج.م)')} aria-label={tb('COD amount (EGP)', 'قيمة الدفع عند الاستلام')} className={inputCls} />
                <div className="flex gap-2">
                  <button className="flex-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">{tb('Create', 'إنشاء')} {shipChoice === 'aramex' ? 'Aramex' : 'SMSA'}</button>
                  <Link href={`/admin/orders/${order.id}/edit`} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Cancel', 'إلغاء')}</Link>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-sm">
                {/* Veeey Express — our own courier, ONE click. The delivery is handed
                    to YeldnIN; Ops assign the courier + create the reference, so
                    there is no AWB to enter here. */}
                <form action={createVeeeyExpressShipmentAction} className="space-y-2">
                  {hidden({})}
                  <p className="text-xs text-muted-foreground">{tb('Ship with our own courier. The delivery is handed to YeldnIN — Ops assign the courier, and their name + phone come back as the tracking (nothing to type).', 'يُشحن عبر مندوبنا. يُسلَّم الطلب إلى YeldnIN — يعيّن الفريق المندوب ويعود اسمه وهاتفه كتتبّع (لا شيء لإدخاله).')}</p>
                  <button className="w-full rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">{tb('Ship with Veeey Express', 'الشحن عبر فيي إكسبريس')}</button>
                </form>
                {(aramexOn || smsaOn) && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground">{tb('Or create a waybill with an integrated courier (review its details first):', 'أو أنشئ بوليصة عبر شركة شحن متكاملة (راجع بياناتها أولًا):')}</p>
                    <div className="flex gap-2">
                      {aramexOn && <Link href={`/admin/orders/${order.id}/edit?ship=aramex`} className="flex-1 rounded-md border border-border px-3 py-1.5 text-center hover:bg-surface">Aramex</Link>}
                      {smsaOn && <Link href={`/admin/orders/${order.id}/edit?ship=smsa`} className="flex-1 rounded-md border border-border px-3 py-1.5 text-center hover:bg-surface">SMSA</Link>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
