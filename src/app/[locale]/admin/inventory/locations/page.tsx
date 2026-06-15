import { setRequestLocale } from 'next-intl/server';
import { listLocations } from '@/lib/location-service';
import { AdminList } from '@/components/admin/resource-list';
import { pick } from '@/lib/admin-i18n';

export default async function LocationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const locations = await listLocations();
  return (
    <AdminList
      title={tb('Locations', 'المواقع')}
      newHref="/admin/inventory/locations/edit"
      newLabel={tb('New location', 'موقع جديد')}
      head={[tb('Name', 'الاسم'), tb('Type', 'النوع'), tb('UltraFast zone', 'منطقة UltraFast')]}
      rows={locations.map((l) => ({
        key: l.id,
        cells: [l.name, l.type, l.isUltraFastZone ? tb('Yes', 'نعم') : '—'],
        editHref: `/admin/inventory/locations/edit/${l.id}`,
      }))}
    />
  );
}
