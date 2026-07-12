'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveSynonym, deleteSynonym } from '@/lib/search-synonyms-service';

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');

export async function saveSynonymAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  let flag = 'saved=1';
  try {
    await saveSynonym({ term: str(fd, 'term'), synonyms: str(fd, 'synonyms') });
  } catch (e) {
    flag = e instanceof Error && e.message === 'FORBIDDEN' ? 'error=forbidden' : 'error=invalid';
  }
  revalidatePath(`/${locale}/admin/search-synonyms`);
  redirect(`/${locale}/admin/search-synonyms?${flag}`);
}

export async function deleteSynonymAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  let flag = 'deleted=1';
  try {
    await deleteSynonym(str(fd, 'id'));
  } catch (e) {
    flag = e instanceof Error && e.message === 'FORBIDDEN' ? 'error=forbidden' : 'error=1';
  }
  revalidatePath(`/${locale}/admin/search-synonyms`);
  redirect(`/${locale}/admin/search-synonyms?${flag}`);
}
