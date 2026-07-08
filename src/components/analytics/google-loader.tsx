'use client';

import Script from 'next/script';
import { useEffect, useSyncExternalStore } from 'react';
import { getConsent, subscribeConsent } from '@/lib/consent';
import type { GoogleConsentMode } from '@/lib/google-config';

/**
 * Google Analytics 4 + Tag Manager. Ids come from admin settings (passed in),
 * not env. Two load modes (admin-configured in /admin/google):
 *  - 'gated' (default): scripts load only under full consent — matches
 *    Clarity/PostHog behavior; nothing Google-side runs before acceptance.
 *  - 'always': scripts load for every visitor with Google Consent Mode v2
 *    defaults DENIED (no cookies / no identifiers); when the visitor accepts,
 *    a consent update upgrades measurement in place. Better modeling +
 *    conversion coverage, still privacy-safe.
 */
export function GoogleLoader({ ga4Id, gtmId, consentMode = 'gated' }: { ga4Id: string; gtmId: string; consentMode?: GoogleConsentMode }) {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  const granted = consent === 'all';
  const always = consentMode === 'always';

  // In always mode, flip Consent Mode to granted the moment the visitor accepts
  // (and on later visits where consent is already stored).
  useEffect(() => {
    if (!always || !granted) return;
    const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
    w.dataLayer = w.dataLayer || [];
    // Consent commands must be pushed as an Arguments object (a plain array is
    // ignored by gtag.js) — define the standard gtag shim if not present yet.
    // eslint-disable-next-line prefer-rest-params
    if (!w.gtag) w.gtag = function () { w.dataLayer!.push(arguments); };
    w.gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    });
  }, [always, granted]);

  if (!always && !granted) return null;

  return (
    <>
      {always && (
        <Script id="google-consent-default" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});`}
        </Script>
      )}
      {gtmId && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      {ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`}
          </Script>
        </>
      )}
    </>
  );
}
