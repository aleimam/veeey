import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { Link } from '@/i18n/navigation';

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const posts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-heading text-2xl font-semibold text-foreground">Medical Blog</h1>
      {posts.length === 0 ? (
        <p className="text-muted-foreground">No posts published yet.</p>
      ) : (
        <ul className="space-y-6">
          {posts.map((post) => {
            const title = (locale === 'ar' ? post.titleAr : post.titleEn) ?? post.titleEn;
            const excerpt = post.excerptEn;
            return (
              <li key={post.id} className="border-b border-border pb-6">
                <Link href={`/blog/${post.slug}`} className="font-heading text-lg font-medium text-foreground hover:text-primary">
                  {title}
                </Link>
                {excerpt && <p className="mt-2 text-sm text-muted-foreground">{excerpt}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
