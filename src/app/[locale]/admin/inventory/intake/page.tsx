import { setRequestLocale } from 'next-intl/server';
import { listPendingIntake } from '@/lib/intake-service';
import { simulateShipmentAction } from '@/server/inventory-actions';
import { IntakePublishForm } from '@/components/admin/intake-publish-form';
import { ProductSelect } from '@/components/admin/product-select';
import { inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export default async function IntakePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const pending = await listPendingIntake();

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{tb('Inventory intake', 'إدخال المخزون')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {tb('Goods received from YeldnIN (simulated here) arrive as pending lots. Confirm the expiry date and price, then publish them to the live catalog.', 'البضائع المستلَمة من YeldnIN (محاكاة هنا) تصل كدفعات قيد الانتظار. أكِّد تاريخ الصلاحية والسعر، ثم انشرها في الكتالوج المتاح.')}
      </p>

      {/* Simulate a YeldnIN shipment.received (dev/demo only) */}
      <form action={simulateShipmentAction} className="mb-8 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-4">
        <span className="w-full text-xs font-medium uppercase text-muted-foreground">{tb('Simulate a received shipment', 'محاكاة شحنة مستلَمة')}</span>
        <div className="w-80 text-xs">
          {tb('Product', 'المنتج')}
          <ProductSelect name="sku" emit="sku" required />
        </div>
        <label className="text-xs">
          {tb('Quantity', 'الكمية')}
          <input type="number" name="qty" min="1" defaultValue={10} className={`${inputCls} w-24`} />
        </label>
        <input type="hidden" name="locale" value={locale} />
        <button className="rounded-md bg-slate px-3 py-2 text-sm font-medium text-slate-foreground">{tb('Receive', 'استلام')}</button>
      </form>

      <h2 className="mb-3 text-sm font-semibold">{tb('Pending intake', 'إدخال قيد الانتظار')} ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tb('Nothing pending. Simulate a shipment above to try the workflow.', 'لا يوجد شيء في الانتظار. حاكِ شحنة بالأعلى لتجربة سير العمل.')}</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((lot) => (
            <li key={lot.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 text-sm font-medium">
                {lot.product.nameEn} <span className="text-muted-foreground">({lot.product.sku})</span> · {tb('Qty', 'الكمية')} {lot.qtyOnHand} · {lot.location.name}
                {lot.sourceBatchId && <span className="text-muted-foreground"> · {tb('Batch', 'دفعة')} {lot.sourceBatchId}</span>}
              </div>
              <IntakePublishForm locale={locale} lotId={lot.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
