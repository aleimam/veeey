import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { backupView } from '@/lib/backup/backup-service';
import { BackupForm } from './backup-form';

export const dynamic = 'force-dynamic';

export default async function BackupPage({ params }: { params: Promise<{ locale: string }> }) {
  await requirePermission('settings.manage');
  const { locale } = await params;
  setRequestLocale(locale);
  const t = pick(locale);
  const data = await backupView();

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 font-heading text-xl font-semibold">{t('Backup', 'النسخ الاحتياطي')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        {t(
          'Scheduled off-site copies of the database and uploaded files, sent to your own storage over SFTP. The password is encrypted at rest and never shown again.',
          'نسخ خارجية مجدولة لقاعدة البيانات والملفات المرفوعة، تُرسل إلى تخزينك الخاص عبر SFTP. تُشفَّر كلمة المرور عند التخزين ولا تُعرض مرة أخرى.',
        )}
      </p>
      <BackupForm initial={data.config} initialTiers={data.tiers} runs={data.runs} />
    </div>
  );
}
