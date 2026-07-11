import type { MetadataRoute } from 'next';
import { getBranding } from '@/lib/branding-service';

// Installable PWA manifest (FR-PLAT-03). Icons are brand-green; offline shell
// is handled by public/sw.js (registered client-side in the locale layout).
// Name/icon follow admin branding settings (shipped defaults otherwise).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getBranding();
  const custom = branding.siteNameEn !== 'Veeey';
  return {
    name: custom ? branding.siteNameEn : 'Veeey — Health Inside',
    short_name: branding.siteNameEn,
    description:
      'Premium imported supplements & health devices. Expiry shown before you buy.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#48884d',
    icons: branding.faviconUrl
      ? [{ src: branding.faviconUrl, sizes: '64x64', type: 'image/png' }]
      : [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
