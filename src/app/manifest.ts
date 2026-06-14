import type { MetadataRoute } from 'next';

// Installable PWA manifest (FR-PLAT-03). Icons are brand-green; offline shell
// is handled by public/sw.js (registered client-side in the locale layout).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Veeey — Health Inside',
    short_name: 'Veeey',
    description:
      'Premium imported supplements & health devices. Expiry shown before you buy.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#48884d',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
