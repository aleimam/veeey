import { setRequestLocale } from 'next-intl/server';
import { RegisterForm } from '@/components/auth/register-form';

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <RegisterForm locale={locale} />
    </main>
  );
}
