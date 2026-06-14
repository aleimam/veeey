import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <LoginForm locale={locale} />
    </main>
  );
}
