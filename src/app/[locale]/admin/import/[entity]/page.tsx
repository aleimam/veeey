import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { IMPORT_PERMISSION, isImportEntity } from '@/lib/admin-import';
import { ImportForm } from '@/components/admin/import-form';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';

export default async function ImportPage({ params }: { params: Promise<{ locale: string; entity: string }> }) {
  const { locale, entity } = await params;
  setRequestLocale(locale);
  if (!isImportEntity(entity)) notFound(); // 'lots' is export-only
  const e = entity;
  await requirePermission(IMPORT_PERMISSION[e]);
  const t = pick(locale);

  return (
    <div className="p-6">
      <Link href={`/admin/${e}`} className="text-sm text-primary hover:underline">← {t('Back to list', 'العودة إلى القائمة')}</Link>
      <h1 className="mt-2 mb-1 font-heading text-xl font-semibold">{t('Import', 'استيراد')} — {e}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        {t(
          'Upload a CSV. New rows are created; rows whose key already exists are skipped; invalid rows are reported. Download the template for the exact columns. Imports insert records only (no stock, payment, or emails).',
          'ارفع ملف CSV. تُنشأ الصفوف الجديدة، وتُتخطّى الصفوف الموجودة مسبقًا، ويُبلَّغ عن الصفوف غير الصالحة. نزّل القالب لمعرفة الأعمدة الصحيحة. الاستيراد يُنشئ السجلات فقط (بدون مخزون أو دفع أو رسائل).',
        )}
      </p>
      <p className="mb-4">
        <a href={`/api/admin/export/${e}?template=1`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{t('Download template', 'تنزيل القالب')}</a>
      </p>
      <ImportForm entity={e} />
    </div>
  );
}
