'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'unknown' | 'unsupported' | 'unconfigured' | 'on' | 'off' | 'busy';

/** Web Push opt-in for the current device (FR-NOT-02). Subscribes via the service
 *  worker + VAPID key and registers the subscription server-side. */
export function PushOptIn({ vapidPublicKey }: { vapidPublicKey?: string }) {
  const t = useTranslations('storefront.accountNotif');
  const [state, setState] = useState<State>('unknown');

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!vapidPublicKey) { if (active) setState('unconfigured'); return; }
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) { if (active) setState('unsupported'); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (active) setState(sub ? 'on' : 'off');
      } catch {
        if (active) setState('off');
      }
    })();
    return () => { active = false; };
  }, [vapidPublicKey]);

  async function subscribe() {
    if (!vapidPublicKey) return;
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== 'granted') { setState('off'); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
      setState('on');
    } catch {
      setState('off');
    }
  }

  async function unsubscribe() {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState('off');
    } catch {
      setState('on');
    }
  }

  if (state === 'unconfigured') return <p className="text-xs text-muted-foreground">{t('pushUnconfigured')}</p>;
  if (state === 'unsupported') return <p className="text-xs text-muted-foreground">{t('pushUnsupported')}</p>;
  return (
    <button
      onClick={state === 'on' ? unsubscribe : subscribe}
      disabled={state === 'busy' || state === 'unknown'}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50"
    >
      {state === 'on' ? t('disablePush') : t('enablePush')}
    </button>
  );
}
