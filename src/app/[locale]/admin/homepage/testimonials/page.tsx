import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listTestimonials } from '@/lib/home-extras-service';
import { AdminList } from '@/components/admin/resource-list';
import { deleteTestimonialAction } from '@/server/home-extras-actions';
import { pick } from '@/lib/admin-i18n';

export default async function TestimonialsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const items = await listTestimonials();
  return (
    <div>
      <div className="px-6 pt-6"><Link href="/admin/homepage" className="text-sm text-primary hover:underline">← {tb('Homepage', 'الصفحة الرئيسية')}</Link></div>
      <AdminList
        title={tb('Customer reviews', 'آراء العملاء')}
        newHref="/admin/homepage/testimonials/edit"
        newLabel={tb('New review', 'رأي جديد')}
        head={[tb('Name', 'الاسم'), tb('Location', 'الموقع'), tb('Quote', 'الاقتباس'), tb('Order', 'الترتيب'), tb('Active', 'نشط')]}
        rows={items.map((t) => ({
          key: t.id,
          cells: [t.name, t.location ?? '—', t.quoteEn.slice(0, 60) + (t.quoteEn.length > 60 ? '…' : ''), String(t.sortOrder), t.active ? tb('Yes', 'نعم') : '—'],
          editHref: `/admin/homepage/testimonials/edit/${t.id}`,
          actions: (
            <form action={deleteTestimonialAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="locale" value={locale} />
              <button className="text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
            </form>
          ),
        }))}
      />
    </div>
  );
}
