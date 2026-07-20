import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // `ssh2` (via ssh2-sftp-client, the backup SFTP transport) MUST stay external:
  // it ships an optional native `sshcrypto.node` and webpack has no loader for a
  // binary, so bundling it fails the build outright.
  //
  // ⚠ This does NOT reproduce everywhere. The addon only exists once ssh2's
  // install script has run — production `npm ci` builds it, while a dev box with
  // npm script-blocking never has the file. A green local build therefore does
  // not clear this; it took YeldnIN's production site down. See BACKUP.md §10.1.
  serverExternalPackages: ['ssh2', 'ssh2-sftp-client'],
  // Imported product images are still served from Egypt Vitamins' BunnyCDN until
  // they're re-hosted on Veeey storage (follow-up). Allowlist those hosts so
  // next/image can load them.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'egyptvitamin.b-cdn.net' },
      { protocol: 'https', hostname: 'egyptvitamins.com' },
      { protocol: 'https', hostname: '*.egyptvitamins.com' },
    ],
  },
  async headers() {
    return [
      {
        // Baseline security headers sitewide (NFR-02 / NFR-08 hardening).
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Never cache the service worker; keep users on the latest shell.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
