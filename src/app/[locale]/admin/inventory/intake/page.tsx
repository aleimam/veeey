import { setRequestLocale } from 'next-intl/server';
import { listPendingIntake } from '@/lib/intake-service';
import { listProducts } from '@/lib/catalog-service';
import { simulateShipmentAction } from '@/server/inventory-actions';
import { IntakePublishForm } from '@/components/admin/intake-publish-form';
import { inputCls } from '@/components/admin/ui';

export default async function IntakePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [pending, products] = await Promise.all([listPendingIntake(), listProducts()]);

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">إدخال المخزون</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        البضائع المستلَمة من YeldnIN (محاكاة هنا) تصل كدفعات قيد الانتظار. أكِّد تاريخ الصلاحية والسعر، ثم انشرها في الكتالوج المتاح.
      </p>

      {/* Simulate a YeldnIN shipment.received (dev/demo only) */}
      <form action={simulateShipmentAction} className="mb-8 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-4">
        <span className="w-full text-xs font-medium uppercase text-muted-foreground">محاكاة شحنة مستلَمة</span>
        <label className="text-xs">
          المنتج
          <select name="sku" required className={`${inputCls} w-64`}>
            <option value="">— اختر —</option>
            {products.map((p) => <option key={p.id} value={p.sku}>{p.nameEn} ({p.sku})</option>)}
          </select>
        </label>
        <label className="text-xs">
          الكمية
          <input type="number" name="qty" min="1" defaultValue={10} className={`${inputCls} w-24`} />
        </label>
        <input type="hidden" name="locale" value={locale} />
        <button className="rounded-md bg-slate px-3 py-2 text-sm font-medium text-slate-foreground">استلام</button>
      </form>

      <h2 className="mb-3 text-sm font-semibold">إدخال قيد الانتظار ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا يوجد شيء في الانتظار. حاكِ شحنة بالأعلى لتجربة سير العمل.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((lot) => (
            <li key={lot.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 text-sm font-medium">
                {lot.product.nameEn} <span className="text-muted-foreground">({lot.product.sku})</span> · الكمية {lot.qtyOnHand} · {lot.location.name}
                {lot.sourceBatchId && <span className="text-muted-foreground"> · دفعة {lot.sourceBatchId}</span>}
              </div>
              <IntakePublishForm locale={locale} lotId={lot.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
