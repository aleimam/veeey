import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
import { SocialAuthButtons } from '@/components/auth/social-auth-buttons';
import { getEnabledSocialProviders } from '@/lib/social-auth';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const providers = await getEnabledSocialProviders();
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <LoginForm locale={locale} social={providers.length ? <SocialAuthButtons providers={providers} locale={locale} /> : null} />
    </main>
  );
}
