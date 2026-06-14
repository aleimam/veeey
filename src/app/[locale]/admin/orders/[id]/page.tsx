import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { getOrder } from '@/lib/order-service';
import { listGifts } from '@/lib/gift-service';
import { listProducts } from '@/lib/catalog-service';
import { ALLOWED_TRANSITIONS, type OrderStatus } from '@/lib/order-status';
import { formatEGP } from '@/lib/format';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import {
  transitionOrderAction, assignPharmacistAction, setPayCheckAction, setOrderMetaAction,
  setTrackingAction, addOrderItemAction, removeOrderItemAction, addGiftToOrderAction,
} from '@/server/order-actions';

const monthYear = (d: Date | null) => (d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : '—');

export default async function OrderDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const order = await getOrder(id);
  if (!order) notFound();

  const [staff, gifts, products] = await Promise.all([
    prisma.user.findMany({ where: { roleId: { not: null } }, select: { id: true, name: true, email: true } }),
    listGifts(),
    listProducts(),
  ]);
  const editable = (['HOLD', 'EDIT', 'PROCESSING', 'PENDING_CONFIRMATION'] as string[]).includes(order.status);
  const transitions = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? [];
  const hidden = (extra: Record<string, string>) =>
    Object.entries({ locale, id, ...extra }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.customer?.user.email ?? order.guestEmail ?? 'guest'} · {order.placedAt.toISOString().slice(0, 10)} · risk {order.riskScore ?? 0} · <StatusBadge status={order.status} />
          </p>
        </div>
        <a href={`/api/admin/orders/${order.id}/invoice`} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Print invoice (PDF)</a>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items + edit-in-Hold */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Items</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr><th className="p-2 text-start">Product</th><th className="p-2">Expiry</th><th className="p-2">Weight</th><th className="p-2">Qty</th><th className="p-2">Line</th><th className="p-2" /></tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="p-2">{it.product.nameEn} <span className="text-muted-foreground">({it.product.sku})</span></td>
                    <td className="p-2 text-center">{monthYear(it.lineExpiry)}</td>
                    <td className="p-2 text-center">{it.product.weightG != null ? `${it.product.weightG}g` : '—'}</td>
                    <td className="p-2 text-center">{it.qty}</td>
                    <td className="p-2 text-center">{formatEGP(Number(it.unitPricePiastres) * it.qty)}</td>
                    <td className="p-2 text-end">
                      {editable && (
                        <form action={removeOrderItemAction}>{hidden({ orderItemId: it.id })}<button className="text-xs text-destructive hover:underline">Remove</button></form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {order.gifts.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">🎁 Internal gifts (hidden from customer): {order.gifts.map((g) => `${g.gift.code}×${g.qty}`).join(', ')}</p>
          )}
          <div className="mt-2 text-end text-sm">
            <span className="text-muted-foreground">Total </span><span className="font-semibold">{formatEGP(Number(order.totalPiastres))}</span>
          </div>

          {editable && (
            <form action={addOrderItemAction} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
              {hidden({})}
              <span className="w-full text-xs font-medium uppercase text-muted-foreground">Edit-in-Hold — add item</span>
              <select name="productId" className={`${inputCls} w-64`} required>
                <option value="">— product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.nameEn} ({p.sku})</option>)}
              </select>
              <input type="number" name="qty" min="1" defaultValue={1} className={`${inputCls} w-20`} />
              <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Add (FEFO)</button>
            </form>
          )}
        </section>

        {/* Controls */}
        <aside className="space-y-5 text-sm">
          <div className="rounded-lg border border-border p-4">
            <p className="mb-2 font-medium">Status</p>
            <div className="flex flex-wrap gap-2">
              {transitions.length === 0 && <span className="text-xs text-muted-foreground">Terminal status.</span>}
              {transitions.map((t) => (
                <form key={t} action={transitionOrderAction}>{hidden({ status: t })}<button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">{t}</button></form>
              ))}
            </div>
          </div>

          <form action={assignPharmacistAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-2 font-medium">Pharmacist</p>
            <select name="pharmacistId" defaultValue={order.pharmacist?.id ?? ''} className={inputCls}>
              <option value="">— unassigned —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name ?? s.email}</option>)}
            </select>
            <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">Assign</button>
          </form>

          <form action={setPayCheckAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-2 font-medium">Pay check</p>
            <select name="payCheck" defaultValue={order.payCheck} className={inputCls}>
              {['NO', 'YES', 'PROBLEM'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">Save</button>
          </form>

          <form action={setTrackingAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-2 font-medium">Tracking → Shipped</p>
            <input name="trackingNumber" placeholder="AWB number" defaultValue={order.trackingNumber ?? ''} className={inputCls} />
            <select name="courier" defaultValue={order.courier ?? ''} className={`${inputCls} mt-2`}>
              <option value="">— courier —</option>
              {['ARAMEX', 'SMSA', 'OWN'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">Add tracking</button>
          </form>

          <form action={setOrderMetaAction} className="rounded-lg border border-border p-4">
            {hidden({})}
            <p className="mb-2 font-medium">Metadata</p>
            <select name="customerOrderType" defaultValue={order.customerOrderType ?? ''} className={inputCls}>
              <option value="">Customer type…</option>
              {['DISCOUNT_CHASER', 'DOCTOR_RECOMMENDED', 'SALES_ADVICE', 'SELF_ORDERING'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select name="orderProductType" defaultValue={order.orderProductType ?? ''} className={`${inputCls} mt-2`}>
              <option value="">Product type…</option>
              {['MISCELLANEOUS', 'MALE_SUPPORT', 'PREMIUM', 'NEW', 'TREND'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <input name="source" placeholder="Order source" defaultValue={order.source ?? ''} className={`${inputCls} mt-2`} />
            <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">Save</button>
          </form>

          {gifts.length > 0 && (
            <form action={addGiftToOrderAction} className="rounded-lg border border-border p-4">
              {hidden({})}
              <p className="mb-2 font-medium">Add gift (hidden)</p>
              <select name="giftId" className={inputCls}>
                {gifts.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.internalName} (stock {g.stock})</option>)}
              </select>
              <input type="number" name="qty" min="1" defaultValue={1} className={`${inputCls} mt-2`} />
              <button className="mt-2 w-full rounded-md border border-border px-3 py-1.5 hover:bg-surface">Add gift</button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
