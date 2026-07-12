'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';

type TP = { loadFromElement?: (el: HTMLElement, forceReload: boolean) => void };

/** Loads the Trustpilot TrustBox bootstrap once (rendered only when configured). */
export function TrustpilotLoader() {
  return <Script src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js" strategy="afterInteractive" />;
}

/** One TrustBox widget. Renders the Trustpilot-authored markup, then asks the
 *  bootstrap to hydrate it (polling briefly since the script loads async). */
export function TrustBox({ businessUnitId, template, height, locale, theme, domain }: {
  businessUnitId: string; template: string; height: number; locale: string; theme: 'light' | 'dark'; domain: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const tp = (window as unknown as { Trustpilot?: TP }).Trustpilot;
      if (tp?.loadFromElement && ref.current) { tp.loadFromElement(ref.current, true); return; }
      if (tries++ < 40) timer = setTimeout(tick, 250); // wait up to ~10s for the async bootstrap
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  const reviewUrl = domain ? `https://www.trustpilot.com/review/${domain}` : 'https://www.trustpilot.com';
  return (
    <div
      ref={ref}
      className="trustpilot-widget"
      data-locale={locale}
      data-template-id={template}
      data-businessunit-id={businessUnitId}
      data-style-height={`${height}px`}
      data-style-width="100%"
      data-theme={theme}
    >
      <a href={reviewUrl} target="_blank" rel="noopener noreferrer">Trustpilot</a>
    </div>
  );
}
