import { getGoogleConfig } from '@/lib/google-service';
import { GoogleLoader } from '@/components/analytics/google-loader';

/**
 * Server wrapper: reads the admin-configured Google settings and emits the
 * Search Console verification <meta> (no consent needed — it's not tracking;
 * Next hoists it to <head>), plus the consent-gated GA4/GTM loader.
 */
export async function GoogleTags() {
  const { ga4Id, gtmId, searchConsole } = await getGoogleConfig();
  if (!ga4Id && !gtmId && !searchConsole) return null;
  return (
    <>
      {searchConsole && <meta name="google-site-verification" content={searchConsole} />}
      <GoogleLoader ga4Id={ga4Id} gtmId={gtmId} />
    </>
  );
}
