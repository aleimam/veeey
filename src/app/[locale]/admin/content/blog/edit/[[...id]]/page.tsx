import { setRequestLocale } from 'next-intl/server';
import { getPost } from '@/lib/content-service';
import { savePostAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'titleEn', label: 'العنوان (إنجليزي)', type: 'text', required: true },
  { name: 'titleAr', label: 'العنوان (عربي)', type: 'text' },
  { name: 'slug', label: 'المُعرّف', type: 'slug' },
  { name: 'excerptEn', label: 'المقتطف (إنجليزي)', type: 'textarea' },
  { name: 'bodyEn', label: 'النص (إنجليزي)', type: 'textarea' },
  { name: 'bodyAr', label: 'النص (عربي)', type: 'textarea' },
  { name: 'status', label: 'الحالة', type: 'select', options: [{ value: 'DRAFT', label: 'مسودة' }, { value: 'PUBLISHED', label: 'منشور' }, { value: 'ARCHIVED', label: 'مؤرشف' }] },
];

export default async function PostEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const postId = id?.[0];
  const post = postId ? await getPost(postId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{postId ? 'تعديل المقال' : 'مقال جديد'}</h1>
      <EntityForm action={savePostAction} fields={FIELDS} defaults={post ?? {}} id={postId} locale={locale} listHref="/admin/content/blog" />
    </div>
  );
}
