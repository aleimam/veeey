import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { listApiKeys } from '@/lib/api-key-service';
import { pick } from '@/lib/admin-i18n';
import { ApiKeysManager } from '@/components/admin/api-keys-manager';

export const dynamic = 'force-dynamic';

export default async function AiKeysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission('settings.manage');
  const tb = pick(locale);
  const keys = await listApiKeys();

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'veeey.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="font-heading text-xl font-semibold text-foreground">{tb('AI access keys', 'مفاتيح وصول الذكاء الاصطناعي')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {tb('Give Claude, ChatGPT or any model a scoped key to read the catalog and propose changes (writes need your approval).', 'امنح Claude أو ChatGPT أو أي نموذج مفتاحًا بصلاحيات محددة لقراءة الكتالوج واقتراح التعديلات (التعديلات تحتاج موافقتك).')}
        </p>
      </header>
      <ApiKeysManager keys={keys} locale={locale} baseUrl={baseUrl} />
    </div>
  );
}
