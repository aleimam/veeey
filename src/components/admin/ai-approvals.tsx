'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { approveProposalAction, rejectProposalAction } from '@/server/ai-access-actions';

export type ProposalRow = {
  id: string;
  clientName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payloadJson: unknown;
  status: string;
  resultJson: unknown;
  note: string | null;
  createdAt: Date;
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-gold/15 text-gold',
  APPLIED: 'bg-primary/10 text-primary',
  FAILED: 'bg-destructive/10 text-destructive',
  REJECTED: 'bg-muted text-muted-foreground',
};

export function AiApprovals({ proposals, locale, supportedActions }: { proposals: ProposalRow[]; locale: string; supportedActions: string[] }) {
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Record<string, string>>({});

  if (proposals.length === 0) {
    return <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t('No AI proposals yet. When a connected model requests a change, it appears here for approval.', 'لا توجد اقتراحات بعد. عندما يطلب نموذج متصل تعديلًا، يظهر هنا للموافقة.')}</p>;
  }

  return (
    <div className="space-y-3">
      {proposals.map((p) => {
        const supported = supportedActions.includes(p.action);
        const result = p.resultJson as { summary?: string; error?: string } | null;
        return (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[p.status] ?? 'bg-muted text-muted-foreground'}`}>{p.status}</span>
              <span className="font-mono text-sm font-semibold text-foreground">{p.action}</span>
              <span className="text-xs text-muted-foreground">{p.entityType}{p.entityId ? ` · ${p.entityId}` : ''}</span>
              <span className="ms-auto text-[11px] text-muted-foreground">{p.clientName ?? 'AI'} · {new Date(p.createdAt).toISOString().slice(0, 16).replace('T', ' ')}</span>
            </div>

            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-2.5 text-xs text-foreground">{JSON.stringify(p.payloadJson, null, 2)}</pre>

            {p.status === 'PENDING' ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pending || !supported}
                  title={supported ? undefined : t('This action is not supported by the applier yet.', 'هذا الإجراء غير مدعوم بعد.')}
                  onClick={() => start(async () => { const r = await approveProposalAction(p.id); setMsg((m) => ({ ...m, [p.id]: r.message })); router.refresh(); })}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {t('Approve & apply', 'موافقة وتطبيق')}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { const note = prompt(t('Reason for rejecting (optional):', 'سبب الرفض (اختياري):')) ?? undefined; start(async () => { await rejectProposalAction(p.id, note); router.refresh(); }); }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface"
                >
                  {t('Reject', 'رفض')}
                </button>
                {!supported && <span className="text-[11px] text-muted-foreground">{t('Unsupported action — reject, or add a handler.', 'إجراء غير مدعوم — ارفضه أو أضف معالجًا.')}</span>}
                {msg[p.id] && <span className="text-xs text-foreground">{msg[p.id]}</span>}
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                {result?.summary && <span className="text-primary">{result.summary}</span>}
                {result?.error && <span className="text-destructive">{result.error}</span>}
                {p.note && <span> · {t('Note', 'ملاحظة')}: {p.note}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
