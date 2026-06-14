import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/feed-service';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/api/', '/checkout', '/cart'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
