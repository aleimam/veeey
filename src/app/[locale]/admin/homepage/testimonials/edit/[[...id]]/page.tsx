import { setRequestLocale } from 'next-intl/server';
import { getTestimonial } from '@/lib/home-extras-service';
import { saveTestimonialAction } from '@/server/home-extras-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'quoteEn', label: 'Quote (English)', type: 'textarea', required: true },
  { name: 'quoteAr', label: 'Quote (Arabic)', type: 'textarea' },
  { name: 'sortOrder', label: 'Sort order', type: 'text' },
  { name: 'active', label: 'Active', type: 'checkbox' },
];

export default async function TestimonialEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tid = id?.[0];
  const item = tid ? await getTestimonial(tid) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tid ? 'Edit testimonial' : 'New testimonial'}</h1>
      <EntityForm action={saveTestimonialAction} fields={FIELDS} defaults={item ?? { active: true, sortOrder: 0 }} id={tid} locale={locale} listHref="/admin/homepage/testimonials" />
    </div>
  );
}
