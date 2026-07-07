import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { listProposals } from '@/lib/ai-proposal-service';
import { SUPPORTED_ACTIONS } from '@/lib/ai-apply';
import { pick } from '@/lib/admin-i18n';
import { AiApprovals } from '@/components/admin/ai-approvals';

export const dynamic = 'force-dynamic';

export default async function AiApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission('settings.manage');
  const tb = pick(locale);
  const proposals = await listProposals(undefined, 100);
  const pendingCount = proposals.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {tb('AI approval inbox', 'صندوق موافقات الذكاء الاصطناعي')}
          {pendingCount > 0 && <span className="ms-2 rounded-full bg-gold/15 px-2 py-0.5 text-sm font-medium text-gold">{pendingCount} {tb('pending', 'قيد الانتظار')}</span>}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {tb('Every change a connected model proposes is staged here. Nothing is applied until you approve it.', 'كل تعديل يقترحه نموذج متصل يُسجَّل هنا. لا يُطبَّق شيء حتى توافق عليه.')}
        </p>
      </header>
      <AiApprovals proposals={proposals} locale={locale} supportedActions={SUPPORTED_ACTIONS} />
    </div>
  );
}
