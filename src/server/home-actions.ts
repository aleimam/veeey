'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { HOME_FIELDS, FEATURED_KEY, saveHomeContent } from '@/lib/home-content-service';
import { saveHomeLayout } from '@/lib/home-layout-service';
import { savePageLayout, deletePageLayout } from '@/lib/page-layout-service';
import type { Block } from '@/lib/home-layout';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined; };

/** Save the homepage block layout (the section/gadget builder). */
export async function saveHomeLayoutAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const raw = fd.get('layout');
  try {
    const blocks = JSON.parse(typeof raw === 'string' ? raw : '[]') as Block[];
    await saveHomeLayout(blocks);
  } catch (e) {
    console.error('home layout save failed', e);
    revalidatePath(`/${locale}/admin/homepage`);
    redirect(`/${locale}/admin/homepage?error=1`);
  }
  revalidatePath(`/${locale}/admin/homepage`);
  revalidatePath(`/${locale}`);
  redirect(`/${locale}/admin/homepage?saved=1`);
}

/** Create/update a composable landing page (PageLayout). */
export async function savePageLayoutAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  let savedId = id;
  try {
    const raw = fd.get('layout');
    const blocks = JSON.parse(typeof raw === 'string' ? raw : '[]') as Block[];
    const row = await savePageLayout({
      id,
      slug: str(fd, 'slug'),
      titleEn: str(fd, 'titleEn') ?? '',
      titleAr: str(fd, 'titleAr') ?? null,
      status: str(fd, 'status') ?? 'DRAFT',
      blocks,
    });
    savedId = row.id;
  } catch (e) {
    console.error('page layout save failed', e);
    revalidatePath(`/${locale}/admin/landing`);
    redirect(`/${locale}/admin/landing/edit/${id ?? ''}?error=1`);
  }
  revalidatePath(`/${locale}/admin/landing`);
  revalidatePath(`/${locale}/l`);
  redirect(`/${locale}/admin/landing/edit/${savedId}?saved=1`);
}

export async function deletePageLayoutAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try { await deletePageLayout(id); } catch (e) { console.error('page layout delete failed', e); }
  }
  revalidatePath(`/${locale}/admin/landing`);
  redirect(`/${locale}/admin/landing`);
}

export async function saveHomeContentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const values: Record<string, string> = {};
  for (const f of HOME_FIELDS) {
    for (const lang of ['en', 'ar']) {
      const k = `${f.key}.${lang}`;
      const v = fd.get(k);
      values[k] = typeof v === 'string' ? v : '';
    }
  }
  const featured = fd.get(FEATURED_KEY);
  values[FEATURED_KEY] = typeof featured === 'string' ? featured : '';
  try {
    await saveHomeContent(values);
  } catch (e) {
    console.error('home content save failed', e);
    revalidatePath(`/${locale}/admin/homepage`);
    redirect(`/${locale}/admin/homepage?error=1`);
  }
  // Homepage + layout are dynamic; revalidate the storefront root too.
  revalidatePath(`/${locale}/admin/homepage`);
  revalidatePath(`/${locale}`);
  redirect(`/${locale}/admin/homepage?saved=1`);
}
