import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listPageLayouts } from '@/lib/page-layout-service';
import { deletePageLayoutAction } from '@/server/home-actions';
import { StatusBadge } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export default async function LandingPagesAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const pages = await listPageLayouts();

  return (
    <div className="p-6">
      <header className="mb-2 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">{tb('Landing pages', 'صفحات الهبوط')} ({pages.length})</h1>
        <Link href="/admin/landing/edit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('New page', 'صفحة جديدة')}</Link>
      </header>
      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
        {tb('Build custom pages from the same blocks as the homepage (rich content, banners, product rows, CTAs, tiles). A published page is live at /l/<slug>.', 'أنشئ صفحات مخصصة بنفس عناصر الصفحة الرئيسية (محتوى منسّق، بانرات، صفوف منتجات، دعوات لإجراء، بطاقات). الصفحة المنشورة تظهر على /l/<slug>.')}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Title', 'العنوان')}</th>
              <th className="p-3 text-start">{tb('URL', 'الرابط')}</th>
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3 font-medium">{p.titleEn}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">/l/{p.slug}</td>
                <td className="p-3"><StatusBadge status={p.status} /></td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-3">
                    {p.status === 'PUBLISHED' && <Link href={`/l/${p.slug}`} target="_blank" className="text-muted-foreground hover:underline">↗ {tb('View', 'عرض')}</Link>}
                    <Link href={`/admin/landing/edit/${p.id}`} className="text-primary hover:underline">{tb('Edit', 'تعديل')}</Link>
                    <form action={deletePageLayoutAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{tb('No landing pages yet.', 'لا توجد صفحات هبوط بعد.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
