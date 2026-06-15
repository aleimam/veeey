import { setRequestLocale } from 'next-intl/server';
import { getTestimonial } from '@/lib/home-extras-service';
import { saveTestimonialAction } from '@/server/home-extras-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function TestimonialEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'name', label: tb('Name', 'الاسم'), type: 'text', required: true },
    { name: 'location', label: tb('Location', 'الموقع'), type: 'text' },
    { name: 'quoteEn', label: tb('Quote (English)', 'الاقتباس (إنجليزي)'), type: 'textarea', required: true },
    { name: 'quoteAr', label: tb('Quote (Arabic)', 'الاقتباس (عربي)'), type: 'textarea' },
    { name: 'sortOrder', label: tb('Order', 'الترتيب'), type: 'text' },
    { name: 'active', label: tb('Active', 'نشط'), type: 'checkbox' },
  ];
  const tid = id?.[0];
  const item = tid ? await getTestimonial(tid) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tid ? tb('Edit customer review', 'تعديل رأي العميل') : tb('New review', 'رأي جديد')}</h1>
      <EntityForm action={saveTestimonialAction} fields={FIELDS} defaults={item ?? { active: true, sortOrder: 0 }} id={tid} locale={locale} listHref="/admin/homepage/testimonials" />
    </div>
  );
}
