'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveSearchRule, deleteSearchRule, type SearchRuleKind } from '@/lib/search-rules-service';

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');

export async function saveSearchRuleAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  let flag = 'saved=1';
  try {
    await saveSearchRule({
      query: str(fd, 'query') ?? '',
      kind: (str(fd, 'kind') === 'REDIRECT' ? 'REDIRECT' : 'REWRITE') as SearchRuleKind,
      rewriteTo: str(fd, 'rewriteTo'),
      targetUrl: str(fd, 'targetUrl'),
      note: str(fd, 'note'),
    });
  } catch (e) {
    flag = e instanceof Error && e.message === 'FORBIDDEN' ? 'error=forbidden' : 'error=invalid';
  }
  revalidatePath(`/${locale}/admin/search-rules`);
  redirect(`/${locale}/admin/search-rules?${flag}`);
}

export async function deleteSearchRuleAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  let flag = 'deleted=1';
  try {
    await deleteSearchRule(str(fd, 'id') ?? '');
  } catch (e) {
    flag = e instanceof Error && e.message === 'FORBIDDEN' ? 'error=forbidden' : 'error=1';
  }
  revalidatePath(`/${locale}/admin/search-rules`);
  redirect(`/${locale}/admin/search-rules?${flag}`);
}
