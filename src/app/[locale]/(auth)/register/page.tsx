import { setRequestLocale } from 'next-intl/server';
import { RegisterForm } from '@/components/auth/register-form';

type SP = Record<string, string | string[] | undefined>;

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <RegisterForm locale={locale} referralCode={ref} />
    </main>
  );
}
