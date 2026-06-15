import { setRequestLocale } from 'next-intl/server';
import { getTestimonial } from '@/lib/home-extras-service';
import { saveTestimonialAction } from '@/server/home-extras-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'الاسم', type: 'text', required: true },
  { name: 'location', label: 'الموقع', type: 'text' },
  { name: 'quoteEn', label: 'الاقتباس (إنجليزي)', type: 'textarea', required: true },
  { name: 'quoteAr', label: 'الاقتباس (عربي)', type: 'textarea' },
  { name: 'sortOrder', label: 'الترتيب', type: 'text' },
  { name: 'active', label: 'نشط', type: 'checkbox' },
];

export default async function TestimonialEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tid = id?.[0];
  const item = tid ? await getTestimonial(tid) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tid ? 'تعديل رأي العميل' : 'رأي جديد'}</h1>
      <EntityForm action={saveTestimonialAction} fields={FIELDS} defaults={item ?? { active: true, sortOrder: 0 }} id={tid} locale={locale} listHref="/admin/homepage/testimonials" />
    </div>
  );
}
