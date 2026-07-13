import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
import { SocialAuthButtons } from '@/components/auth/social-auth-buttons';
import { getEnabledSocialProviders } from '@/lib/social-auth';
import { isFeatureEnabled } from '@/lib/feature-service';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next; // return path after login (validated server-side)
  const providers = (await isFeatureEnabled('socialLogin')) ? await getEnabledSocialProviders() : [];
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <LoginForm locale={locale} next={next} social={providers.length ? <SocialAuthButtons providers={providers} locale={locale} /> : null} />
    </main>
  );
}
