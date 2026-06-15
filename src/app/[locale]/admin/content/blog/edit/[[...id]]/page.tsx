import { setRequestLocale } from 'next-intl/server';
import { getPost } from '@/lib/content-service';
import { savePostAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function PostEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'titleEn', label: tb('Title (English)', 'العنوان (إنجليزي)'), type: 'text', required: true },
    { name: 'titleAr', label: tb('Title (Arabic)', 'العنوان (عربي)'), type: 'text' },
    { name: 'slug', label: tb('Slug', 'المُعرّف'), type: 'slug' },
    { name: 'excerptEn', label: tb('Excerpt (English)', 'المقتطف (إنجليزي)'), type: 'textarea' },
    { name: 'bodyEn', label: tb('Body (English)', 'النص (إنجليزي)'), type: 'textarea' },
    { name: 'bodyAr', label: tb('Body (Arabic)', 'النص (عربي)'), type: 'textarea' },
    { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: [{ value: 'DRAFT', label: tb('Draft', 'مسودة') }, { value: 'PUBLISHED', label: tb('Published', 'منشور') }, { value: 'ARCHIVED', label: tb('Archived', 'مؤرشف') }] },
  ];
  const postId = id?.[0];
  const post = postId ? await getPost(postId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{postId ? tb('Edit post', 'تعديل المقال') : tb('New post', 'مقال جديد')}</h1>
      <EntityForm action={savePostAction} fields={FIELDS} defaults={post ?? {}} id={postId} locale={locale} listHref="/admin/content/blog" />
    </div>
  );
}
