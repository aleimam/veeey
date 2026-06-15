import { setRequestLocale } from 'next-intl/server';
import { getLocation } from '@/lib/location-service';
import { saveLocationAction } from '@/server/inventory-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function LocationEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'name', label: tb('Name', 'الاسم'), type: 'text', required: true },
    { name: 'type', label: tb('Type', 'النوع'), type: 'text', hint: tb('e.g. warehouse, office', 'مثال: مخزن، مكتب') },
    { name: 'isUltraFastZone', label: tb('UltraFast zone', 'منطقة UltraFast'), type: 'checkbox' },
  ];
  const locationId = id?.[0];
  const location = locationId ? await getLocation(locationId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{locationId ? tb('Edit location', 'تعديل الموقع') : tb('New location', 'موقع جديد')}</h1>
      <EntityForm action={saveLocationAction} fields={FIELDS} defaults={location ?? { type: 'warehouse' }} id={locationId} locale={locale} listHref="/admin/inventory/locations" />
    </div>
  );
}
