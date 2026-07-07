'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { getConsent, subscribeConsent } from '@/lib/consent';

/**
 * Google Analytics 4 + Tag Manager, loaded only under full consent (matching
 * Clarity/PostHog). Ids come from admin settings (passed in), not env. GA4 and
 * GTM are independent — inject whichever the manager configured.
 */
export function GoogleLoader({ ga4Id, gtmId }: { ga4Id: string; gtmId: string }) {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  if (consent !== 'all') return null;

  return (
    <>
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
