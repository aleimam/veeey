'use client';

import { useState } from 'react';
import { requestReturnAction } from '@/server/account-actions';

export type ReturnReasonOption = { id: string; label: string; requiresDetail: boolean };

/**
 * Customer return request: pick a managed reason from the dropdown; reasons
 * flagged requiresDetail (e.g. "Product issue", "Other") reveal a required
 * free-text field for the sub-detail / one-off case.
 */
export function ReturnRequestForm({
  orderId,
  locale,
  reasons,
  labels,
}: {
  orderId: string;
  locale: string;
  reasons: ReturnReasonOption[];
  labels: { submit: string; choose: string; detail: string };
}) {
  const [reasonId, setReasonId] = useState('');
  const selected = reasons.find((r) => r.id === reasonId);
  const cls = 'rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-2 py-1 text-xs text-ink';

  return (
    <form action={requestReturnAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="orderId" value={orderId} />
      <select
        name="reasonId"
        required
        value={reasonId}
        onChange={(e) => setReasonId(e.target.value)}
        className={`${cls} min-w-[11rem]`}
      >
        <option value="">{labels.choose}</option>
        {reasons.map((r) => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
      {selected?.requiresDetail && (
        <textarea name="reasonNote" required rows={2} placeholder={labels.detail} className={`${cls} w-full`} />
      )}
      <button className="text-xs font-semibold text-green-dark hover:text-lime-press disabled:opacity-50" disabled={!reasonId}>
        {labels.submit}
      </button>
    </form>
  );
}
