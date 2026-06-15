import { setRequestLocale } from 'next-intl/server';
import { getLot, lotSuggestion } from '@/lib/inventory-service';
import { listProducts } from '@/lib/catalog-service';
import { listLocations } from '@/lib/location-service';
import { piastresToEgp } from '@/lib/format';
import { LotForm } from '@/components/admin/lot-form';

export default async function LotEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const lotId = id?.[0];

  const [lot, products, locations] = await Promise.all([
    lotId ? getLot(lotId) : Promise.resolve(null),
    listProducts(),
    listLocations(),
  ]);
  const suggestion = lotId ? await lotSuggestion(lotId) : null;

  const defaults = lot
    ? {
        id: lot.id,
        productId: lot.productId,
        locationId: lot.locationId,
        expiryDate: lot.expiryDate ? lot.expiryDate.toISOString().slice(0, 10) : '',
        noExpiry: !lot.expiryDate,
        qtyOnHand: lot.qtyOnHand,
        costEgp: lot.costPiastres != null ? piastresToEgp(lot.costPiastres) : '',
        priceOverrideEgp: lot.priceOverridePiastres != null ? piastresToEgp(lot.priceOverridePiastres) : '',
        saleFlag: lot.saleFlag,
        status: lot.status,
      }
    : { locationId: locations[0]?.id };

  const suggestionText =
    suggestion && suggestion.pct > 0
      ? `مقترح −${suggestion.pct}% (≈ ${suggestion.suggestedPiastres != null ? piastresToEgp(suggestion.suggestedPiastres) : '—'} ج.م). ${suggestion.reason} بتأكيد الصيدلي.`
      : undefined;

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{lotId ? 'تعديل الدفعة' : 'دفعة جديدة'}</h1>
      <LotForm
        locale={locale}
        defaults={defaults}
        products={products.map((p) => ({ value: p.id, label: `${p.nameEn} (${p.sku})` }))}
        locations={locations.map((l) => ({ value: l.id, label: l.name }))}
        suggestion={suggestionText}
      />
    </div>
  );
}
