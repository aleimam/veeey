import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/feed-service';

export const revalidate = 3600;

const LOCALES = ['en', 'ar'] as const;
const STATIC = ['', '/products', '/play', '/blog', '/search'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  for (const l of LOCALES) {
    for (const p of STATIC) entries.push({ url: `${SITE_URL}/${l}${p}`, changeFrequency: p === '' ? 'daily' : 'weekly', priority: p === '' ? 1 : 0.6 });
  }
  try {
    const [products, posts, cmsPages] = await Promise.all([
      prisma.product.findMany({ where: { status: 'PUBLISHED' }, select: { slugEn: true, updatedAt: true }, take: 5000 }),
      prisma.blogPost.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, take: 1000 }),
      prisma.cmsPage.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, take: 200 }),
    ]);
    for (const l of LOCALES) {
      for (const p of products) entries.push({ url: `${SITE_URL}/${l}/products/${p.slugEn}`, lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.8 });
      for (const post of posts) entries.push({ url: `${SITE_URL}/${l}/blog/${post.slug}`, lastModified: post.updatedAt, changeFrequency: 'monthly', priority: 0.5 });
      for (const c of cmsPages) entries.push({ url: `${SITE_URL}/${l}/p/${c.slug}`, lastModified: c.updatedAt, changeFrequency: 'monthly', priority: 0.4 });
    }
  } catch {
    // degrade to the static map if the DB is unreachable
  }
  return entries;
}
