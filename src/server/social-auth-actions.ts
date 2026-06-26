'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveGoogleAuth, saveFacebookAuth, saveAppleAuth, clearSocialAuth } from '@/lib/social-auth-service';
import type { SocialProviderId } from '@/lib/social-auth';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
const PATH = (l: string) => `/${l}/admin/login-providers`;

export async function saveGoogleAuthAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveGoogleAuth({
      'auth.google.enabled': fd.get('enabled') != null ? 'true' : 'false',
      'auth.google.clientId': str(fd, 'clientId'),
      'auth.google.clientSecret': str(fd, 'clientSecret'),
    });
  } catch (e) {
    console.error('google auth save failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function saveFacebookAuthAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveFacebookAuth({
      'auth.facebook.enabled': fd.get('enabled') != null ? 'true' : 'false',
      'auth.facebook.clientId': str(fd, 'clientId'),
      'auth.facebook.clientSecret': str(fd, 'clientSecret'),
    });
  } catch (e) {
    console.error('facebook auth save failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function saveAppleAuthAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveAppleAuth({
      'auth.apple.enabled': fd.get('enabled') != null ? 'true' : 'false',
      'auth.apple.servicesId': str(fd, 'servicesId'),
      'auth.apple.teamId': str(fd, 'teamId'),
      'auth.apple.keyId': str(fd, 'keyId'),
      'auth.apple.privateKey': str(fd, 'privateKey'),
    });
  } catch (e) {
    console.error('apple auth save failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function clearSocialAuthAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const provider = str(fd, 'provider') as SocialProviderId;
  try {
    if (provider === 'google' || provider === 'facebook' || provider === 'apple') await clearSocialAuth(provider);
  } catch (e) {
    console.error('social auth clear failed', e);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?cleared=1`);
}
