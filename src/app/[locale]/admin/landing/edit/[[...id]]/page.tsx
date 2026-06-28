import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getPageLayoutById } from '@/lib/page-layout-service';
import { listCollections } from '@/lib/content-service';
import { savePageLayoutAction } from '@/server/home-actions';
import { BlockBuilder } from '@/components/admin/home-builder';
import { Field, inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LandingEditPage({ params, searchParams }: { params: Promise<{ locale: string; id?: string[] }>; searchParams: Promise<SP> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const pageId = id?.[0];

  const [data, collections] = await Promise.all([
    pageId ? getPageLayoutById(pageId) : Promise.resolve(null),
    listCollections(),
  ]);
  const row = data?.row;
  const blocks = data?.blocks ?? [];

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{pageId ? tb('Edit landing page', 'تعديل صفحة الهبوط') : tb('New landing page', 'صفحة هبوط جديدة')}</h1>
        <div className="flex items-center gap-3 text-sm">
          {row?.status === 'PUBLISHED' && <Link href={`/l/${row.slug}`} target="_blank" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">↗ {tb('View on site', 'عرض في المتجر')}</Link>}
          <Link href="/admin/landing" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('All pages', 'كل الصفحات')}</Link>
        </div>
      </div>

      {one(sp.saved) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved.', 'تم الحفظ.')}</p>}
      {one(sp.error) === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save.', 'تعذّر الحفظ.')}</p>}

      <form action={savePageLayoutAction} className="space-y-6">
        <input type="hidden" name="locale" value={locale} />
        {pageId && <input type="hidden" name="id" value={pageId} />}

        <section className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <Field label={tb('Title (English)', 'العنوان (بالإنجليزية)')}><input name="titleEn" required defaultValue={row?.titleEn ?? ''} className={inputCls} /></Field>
          <Field label={tb('Title (Arabic)', 'العنوان (بالعربية)')}><input name="titleAr" defaultValue={row?.titleAr ?? ''} dir="rtl" className={inputCls} /></Field>
          {pageId
            ? <Field label={tb('URL', 'الرابط')}><input value={`/l/${row?.slug ?? ''}`} readOnly disabled className={`${inputCls} opacity-70`} /></Field>
            : <Field label={tb('Slug', 'المُعرّف')} hint={tb('Leave blank to auto-generate from the title.', 'اتركه فارغًا للتوليد التلقائي من العنوان.')}><input name="slug" className={inputCls} /></Field>}
          <Field label={tb('Status', 'الحالة')}>
            <select name="status" defaultValue={row?.status ?? 'DRAFT'} className={inputCls}>
              <option value="DRAFT">{tb('Draft', 'مسودة')}</option>
              <option value="PUBLISHED">{tb('Published', 'منشور')}</option>
            </select>
          </Field>
        </section>

        <BlockBuilder initialBlocks={blocks} collections={collections.map((c) => ({ id: c.id, title: c.titleEn }))} saveLabel={tb('Save page', 'حفظ الصفحة')} />
      </form>
    </div>
  );
}
