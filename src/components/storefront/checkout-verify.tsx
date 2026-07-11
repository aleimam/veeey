'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { requestVerifyCodeAction, confirmVerifyCodeAction, type VerifyState } from '@/server/verify-actions';

const field =
  'mt-1.5 w-full rounded-[8px] border border-[color:var(--slate-border)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-45 focus:border-lime focus:bg-white';

/**
 * Checkout contact verification (V5 F30). Renders inside the checkout form but
 * drives its own server actions via useTransition (no nested <form>). The
 * server independently re-checks the proof cookie at placeOrder.
 */
export function CheckoutVerify({
  locale,
  phone,
  email,
  smsAvailable,
  emailAvailable,
  onVerified,
}: {
  locale: string;
  phone: string;
  email?: string;
  smsAvailable: boolean;
  emailAvailable: boolean;
  onVerified: () => void;
}) {
  const t = useTranslations('storefront.checkout');
  const [channel, setChannel] = useState<'sms' | 'email'>(smsAvailable || !emailAvailable ? 'sms' : 'email');
  const [state, setState] = useState<VerifyState>({});
  const [code, setCode] = useState('');
  const [pending, start] = useTransition();

  const dest = channel === 'sms' ? phone : (email ?? '');
  const destOk = channel === 'sms' ? dest.replace(/\D/g, '').length >= 10 : /\S+@\S+\.\S+/.test(dest);

  const run = (action: (p: VerifyState, fd: FormData) => Promise<VerifyState>, extra?: Record<string, string>) =>
    start(async () => {
      const fd = new FormData();
      fd.set('dest', dest);
      fd.set('locale', locale);
      for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
      const next = await action(state, fd);
      setState(next);
      if (next.verified) onVerified();
    });

  const errText = (e?: string) => {
    if (!e) return null;
    if (e === 'bad_code') return t('verifyBadCode');
    if (e === 'rate_limited') return t('verifyRateLimited');
    if (e === 'invalid_destination') return t('verifyBadDestination');
    return t('verifySendFailed');
  };

  if (state.verified) {
    return <p className="rounded-[10px] border border-green-dark bg-green-wash px-3.5 py-3 text-sm font-semibold text-green-dark">✓ {t('verifyDone')}</p>;
  }

  return (
    <div className="rounded-[10px] border border-[color:var(--gold)] bg-gold-wash p-4">
      <p className="text-sm font-semibold text-ink">{t('verifyTitle')}</p>
      <p className="mt-1 text-xs text-[color:var(--text-muted)]">{t('verifyHint')}</p>

      {smsAvailable && emailAvailable && email && (
        <div className="mt-3 flex gap-4 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="radio" checked={channel === 'sms'} onChange={() => { setChannel('sms'); setState({}); }} className="accent-[color:var(--green-dark)]" />
            {t('verifyBySms')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={channel === 'email'} onChange={() => { setChannel('email'); setState({}); }} className="accent-[color:var(--green-dark)]" />
            {t('verifyByEmail')}
          </label>
        </div>
      )}

      {!state.sent ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink" dir="ltr">{dest || t(channel === 'sms' ? 'verifyEnterPhone' : 'verifyEnterEmail')}</span>
          <button type="button" disabled={!destOk || pending} onClick={() => run(requestVerifyCodeAction)} className="v-btn v-btn--primary disabled:opacity-50">
            {pending ? t('verifySending') : t('verifySend')}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-sm font-semibold text-ink">{t('verifyCodeLabel')}
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" className={`${field} w-32 tracking-widest`} dir="ltr" />
          </label>
          <button type="button" disabled={code.trim().length !== 6 || pending} onClick={() => run(confirmVerifyCodeAction, { code })} className="v-btn v-btn--primary disabled:opacity-50">
            {pending ? t('verifyChecking') : t('verifyConfirm')}
          </button>
          <button type="button" disabled={pending} onClick={() => run(requestVerifyCodeAction)} className="text-sm text-green-dark underline">
            {t('verifyResend')}
          </button>
        </div>
      )}

      {errText(state.error) && <p role="alert" className="mt-2 text-sm text-error">{errText(state.error)}</p>}
    </div>
  );
}
