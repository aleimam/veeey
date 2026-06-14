import { setRequestLocale } from 'next-intl/server';
import { getPost } from '@/lib/content-service';
import { savePostAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'titleEn', label: 'Title (English)', type: 'text', required: true },
  { name: 'titleAr', label: 'Title (Arabic)', type: 'text' },
  { name: 'slug', label: 'Slug', type: 'slug' },
  { name: 'excerptEn', label: 'Excerpt (EN)', type: 'textarea' },
  { name: 'bodyEn', label: 'Body (EN)', type: 'textarea' },
  { name: 'bodyAr', label: 'Body (AR)', type: 'textarea' },
  { name: 'status', label: 'Status', type: 'select', options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'PUBLISHED', label: 'Published' }, { value: 'ARCHIVED', label: 'Archived' }] },
];

export default async function PostEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const postId = id?.[0];
  const post = postId ? await getPost(postId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{postId ? 'Edit post' : 'New post'}</h1>
      <EntityForm action={savePostAction} fields={FIELDS} defaults={post ?? {}} id={postId} locale={locale} listHref="/admin/content/blog" />
    </div>
  );
}
