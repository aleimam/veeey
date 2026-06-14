'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { getConsent, subscribeConsent } from '@/lib/consent';

/**
 * Microsoft Clarity session replay + heatmaps (FR-BEH-02). Injected only under
 * full consent with a configured project id.
 */
export function ClarityLoader() {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  const id = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (consent !== 'all' || !id) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");`}
    </Script>
  );
}
