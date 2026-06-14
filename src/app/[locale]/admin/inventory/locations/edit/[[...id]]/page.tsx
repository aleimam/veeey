import { setRequestLocale } from 'next-intl/server';
import { getLocation } from '@/lib/location-service';
import { saveLocationAction } from '@/server/inventory-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'type', label: 'Type', type: 'text', hint: 'e.g. warehouse, office' },
  { name: 'isUltraFastZone', label: 'UltraFast zone', type: 'checkbox' },
];

export default async function LocationEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const locationId = id?.[0];
  const location = locationId ? await getLocation(locationId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{locationId ? 'Edit location' : 'New location'}</h1>
      <EntityForm action={saveLocationAction} fields={FIELDS} defaults={location ?? { type: 'warehouse' }} id={locationId} locale={locale} listHref="/admin/inventory/locations" />
    </div>
  );
}
