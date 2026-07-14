import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { sanitizeRichHtml, richToText } from '@/lib/rich-text';
import { pick } from '@/lib/admin-i18n';
import { Link } from '@/i18n/navigation';
import { requireFeature } from '@/lib/feature-service';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';

const SITE = 'https://veeey.com';
const loadPost = (slug: string) => prisma.blogPost.findFirst({ where: { slug, status: 'PUBLISHED' } });

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await loadPost(slug);
  if (!post) return {};
  const ar = locale === 'ar';
  const name = (ar ? post.titleAr : post.titleEn) ?? post.titleEn;
  const title = ((ar ? post.metaTitleAr : post.metaTitleEn) || `${name} — Veeey`) as string;
  const desc = ((ar ? post.metaDescAr : post.metaDescEn) ?? richToText((ar ? post.excerptAr : post.excerptEn) ?? post.excerptEn ?? '')) || undefined;
  const url = `/${locale}/blog/${post.slug}`;
  return {
    metadataBase: new URL(SITE),
    title,
    description: desc,
    alternates: { canonical: url, languages: { en: `/en/blog/${post.slug}`, ar: `/ar/blog/${post.slug}`, 'x-default': `/en/blog/${post.slug}` } },
    openGraph: {
      title,
      description: desc,
      url,
      siteName: 'Veeey',
      type: 'article',
      images: post.coverImage ? [post.coverImage] : undefined,
      publishedTime: post.publishedAt?.toISOString(),
      locale: ar ? 'ar_EG' : 'en_US',
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: post.coverImage ? [post.coverImage] : undefined },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await requireFeature('blog', locale);
  const tb = pick(locale);
  const ar = locale === 'ar';
  const post = await loadPost(slug);
  if (!post) notFound();

  const title = (ar ? post.titleAr : post.titleEn) ?? post.titleEn;
  const body = (ar ? post.bodyAr : post.bodyEn) ?? post.bodyEn;
  const desc = ((ar ? post.metaDescAr : post.metaDescEn) ?? richToText((ar ? post.excerptAr : post.excerptEn) ?? post.excerptEn ?? '')) || undefined;

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    ...(post.coverImage ? { image: post.coverImage } : {}),
    ...(desc ? { description: desc } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    dateModified: post.updatedAt.toISOString(),
    ...(post.authorName ? { author: { '@type': 'Person', name: post.authorName } } : {}),
    publisher: { '@type': 'Organization', name: 'Veeey', logo: { '@type': 'ImageObject', url: `${SITE}/brand/veeey-logo.png` } },
    mainEntityOfPage: `${SITE}/${locale}/blog/${post.slug}`,
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: tb('Home', 'الرئيسية'), item: `${SITE}/${locale}` },
      { name: tb('Blog', 'المدوّنة'), item: `${SITE}/${locale}/blog` },
      { name: title, item: `${SITE}/${locale}/blog/${post.slug}` },
    ].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  };

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div className="mb-3.5 flex items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
        <Link href="/">{tb('Home', 'الرئيسية')}</Link>
        <span aria-hidden>{ar ? '‹' : '›'}</span>
        <Link href="/blog">{tb('Blog', 'المدوّنة')}</Link>
      </div>
      <div className="mb-3"><AdminEditLink href={`/admin/content/blog/edit/${post.id}`} locale={locale} /></div>
      <h1 className="text-3xl font-bold text-green-dark sm:text-4xl">{title}</h1>
      {(post.authorName || post.publishedAt) && (
        <div className="mt-3 flex items-center gap-2 text-sm text-[color:var(--text-subtle)]">
          {post.authorName && <span className="font-semibold text-green-dark">{post.authorName}</span>}
          {post.authorName && post.publishedAt && <span aria-hidden>·</span>}
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {post.publishedAt.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
          )}
        </div>
      )}
      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImage} alt="" className="mt-6 w-full rounded-[16px] object-cover" />
      )}
      {body && <div className="veeey-rich mt-6 leading-relaxed text-[color:var(--text-body)]" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(body) }} />}
    </article>
  );
}
