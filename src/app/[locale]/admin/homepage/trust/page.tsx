import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listTrustBadges } from '@/lib/home-extras-service';
import { AdminList } from '@/components/admin/resource-list';
import { deleteTrustBadgeAction } from '@/server/home-extras-actions';

export default async function TrustBadgesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const items = await listTrustBadges();
  return (
    <div>
      <div className="px-6 pt-6"><Link href="/admin/homepage" className="text-sm text-primary hover:underline">← Homepage</Link></div>
      <AdminList
        title="Trust badges"
        newHref="/admin/homepage/trust/edit"
        newLabel="New badge"
        head={['Label (EN)', 'Label (AR)', 'Order', 'Active']}
        rows={items.map((b) => ({
          key: b.id,
          cells: [b.labelEn, b.labelAr ?? '—', String(b.sortOrder), b.active ? 'Yes' : '—'],
          editHref: `/admin/homepage/trust/edit/${b.id}`,
          actions: (
            <form action={deleteTrustBadgeAction}>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="locale" value={locale} />
              <button className="text-destructive hover:underline">Delete</button>
            </form>
          ),
        }))}
      />
    </div>
  );
}
