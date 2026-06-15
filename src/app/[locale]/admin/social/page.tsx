import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listSocialLinks, SOCIAL_PLATFORMS } from '@/lib/social-service';
import { AdminList } from '@/components/admin/resource-list';
import { deleteSocialLinkAction } from '@/server/social-actions';

const platformLabel = (p: string) => SOCIAL_PLATFORMS.find((x) => x.value === p)?.label ?? p;

export default async function SocialPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const links = await listSocialLinks();
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');

  return (
    <AdminList
      title={tl('social')}
      newHref="/admin/social/edit"
      head={[tf('platform'), tf('url'), tf('order'), tf('active')]}
      rows={links.map((s) => ({
        key: s.id,
        cells: [s.label || platformLabel(s.platform), s.url, String(s.sortOrder), s.active ? 'Yes' : '—'],
        editHref: `/admin/social/edit/${s.id}`,
        actions: (
          <form action={deleteSocialLinkAction}>
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-destructive hover:underline">Delete</button>
          </form>
        ),
      }))}
    />
  );
}
