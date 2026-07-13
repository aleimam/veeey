import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { getVariantGroup } from '@/lib/variant-service';
import { VariantGroupEditor } from '@/components/admin/variant-group-editor';

export const dynamic = 'force-dynamic';

export default async function VariantGroupEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  await requirePermission('catalog.write');
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  const groupId = id?.[0];
  const initial = groupId ? await getVariantGroup(groupId) : null;
  if (groupId && !initial) notFound();

  return (
    <div className="max-w-3xl p-4 sm:p-6">
      <Link href="/admin/variant-groups" className="text-sm text-primary hover:underline">← {tb('Variant groups', 'مجموعات المتغيرات')}</Link>
      <h1 className="mb-4 mt-1 font-heading text-xl font-semibold text-foreground">
        {initial ? tb('Edit variant group', 'تعديل مجموعة متغيرات') : tb('New variant group', 'مجموعة متغيرات جديدة')}
      </h1>
      <VariantGroupEditor initial={initial} locale={locale} />
    </div>
  );
}
