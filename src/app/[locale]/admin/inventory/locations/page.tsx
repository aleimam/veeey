import { setRequestLocale } from 'next-intl/server';
import { listLocations } from '@/lib/location-service';
import { AdminList } from '@/components/admin/resource-list';

export default async function LocationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const locations = await listLocations();
  return (
    <AdminList
      title="المواقع"
      newHref="/admin/inventory/locations/edit"
      newLabel="موقع جديد"
      head={['الاسم', 'النوع', 'منطقة UltraFast']}
      rows={locations.map((l) => ({
        key: l.id,
        cells: [l.name, l.type, l.isUltraFastZone ? 'نعم' : '—'],
        editHref: `/admin/inventory/locations/edit/${l.id}`,
      }))}
    />
  );
}
