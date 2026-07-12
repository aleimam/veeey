'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { getGscConfig, saveGscClient, disconnectGsc, submitSitemap, redirectUri } from '@/lib/gsc-service';
import { gscAuthUrl, makeOauthState } from '@/lib/gsc-config';

const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const base = (locale: string) => `/${locale}/admin/google/search-console`;

export async function saveGscClientAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await saveGscClient(str(fd, 'clientId'), str(fd, 'clientSecret'), str(fd, 'property'));
  revalidatePath(base(locale));
  redirect(`${base(locale)}?saved=1`);
}

export async function connectGscAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await requirePermission('settings.manage');
  const cfg = await getGscConfig();
  if (!cfg.clientId) redirect(`${base(locale)}?error=no_client`);
  redirect(gscAuthUrl(cfg.clientId, redirectUri(), makeOauthState(Date.now())));
}

export async function disconnectGscAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await disconnectGsc();
  revalidatePath(base(locale));
  redirect(`${base(locale)}?disconnected=1`);
}

export async function submitSitemapAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const user = await requirePermission('settings.manage');
  const r = await submitSitemap();
  await audit({ actorType: 'USER', actorId: user.id, action: 'gsc.sitemap.submit', entityType: 'Setting', entityId: 'gsc', data: { ok: r.ok, error: r.error } });
  revalidatePath(base(locale));
  redirect(`${base(locale)}?${r.ok ? 'submitted=1' : `submitfail=${encodeURIComponent(r.error ?? '1')}`}`);
}
