'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    grecaptcha?: { ready(cb: () => void): void; execute(key: string, opts: { action: string }): Promise<string> };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

/**
 * Fills the form's `recaptchaToken` with a live reCAPTCHA v3 token (V5 F37).
 * Inert without NEXT_PUBLIC_RECAPTCHA_SITE_KEY — the server side equally
 * bypasses verification while the pair of keys is not configured. Tokens
 * expire after ~2 minutes, so it refreshes on an interval.
 */
export function RecaptchaToken({ action }: { action: string }) {
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!SITE_KEY) return;
    const src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      window.grecaptcha?.ready(() => {
        window.grecaptcha?.execute(SITE_KEY, { action }).then(setToken).catch(() => {});
      });
    };
    // First token once the script lands, then keep it fresh.
    const boot = setInterval(() => {
      if (window.grecaptcha) {
        clearInterval(boot);
        refresh();
        timer = setInterval(refresh, 100_000);
      }
    }, 300);
    return () => {
      clearInterval(boot);
      if (timer) clearInterval(timer);
    };
  }, [action]);

  return <input type="hidden" name="recaptchaToken" value={token} readOnly />;
}
