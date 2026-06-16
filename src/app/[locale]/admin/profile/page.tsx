import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { updateProfileAction } from '@/server/profile-actions';
import { inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = pick(locale);

  const current = await getCurrentUser();
  if (!current) redirect(`/${locale}/admin`);

  const me = await prisma.user.findUnique({
    where: { id: current.id },
    select: { name: true, username: true, phone: true, email: true },
  });

  // Thin inline server action: runs the update, then redirects with a banner
  // flag so this server component can show success/error from searchParams.
  async function save(formData: FormData) {
    'use server';
    const res = await updateProfileAction({}, formData);
    if (res.ok) redirect(`/${locale}/admin/profile?saved=1`);
    redirect(`/${locale}/admin/profile?error=${res.error ?? 'invalid'}`);
  }

  const saved = one(sp.saved) === '1';
  const error = one(sp.error);

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{t('My profile', 'ملفي الشخصي')}</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        {t(
          'Update your own name, username, phone and password. Your email address can’t be changed here.',
          'حدّث اسمك واسم المستخدم والهاتف وكلمة المرور الخاصة بك. لا يمكن تغيير بريدك الإلكتروني من هنا.',
        )}
      </p>

      {saved && (
        <p className="mb-4 max-w-xl rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {t('Profile saved.', 'تم حفظ الملف الشخصي.')}
        </p>
      )}
      {error === 'taken' && (
        <p className="mb-4 max-w-xl rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('That username or phone is already in use.', 'اسم المستخدم أو الهاتف مستخدم بالفعل.')}
        </p>
      )}
      {error && error !== 'taken' && (
        <p className="mb-4 max-w-xl rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('Please check the fields and try again.', 'يرجى مراجعة الحقول والمحاولة مرة أخرى.')}
        </p>
      )}

      <form action={save} className="max-w-xl space-y-5 rounded-lg border border-border p-4">
        <label className="block text-sm font-medium text-foreground">
          {t('Name', 'الاسم')}
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={me?.name ?? ''}
            className={inputCls}
          />
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t('Username', 'اسم المستخدم')}
          <input
            name="username"
            minLength={3}
            maxLength={30}
            autoComplete="off"
            defaultValue={me?.username ?? ''}
            className={inputCls}
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {t('Optional. 3–30 characters.', 'اختياري. من 3 إلى 30 حرفًا.')}
          </span>
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t('Phone', 'الهاتف')}
          <input
            name="phone"
            maxLength={20}
            autoComplete="off"
            defaultValue={me?.phone ?? ''}
            className={inputCls}
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {t('Optional.', 'اختياري.')}
          </span>
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t('New password', 'كلمة مرور جديدة')}
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {t('Leave blank to keep your current password. At least 8 characters.', 'اتركها فارغة للإبقاء على كلمة المرور الحالية. 8 أحرف على الأقل.')}
          </span>
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t('Email', 'البريد الإلكتروني')}
          <input value={me?.email ?? ''} disabled className={`${inputCls} opacity-60`} />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {t('Email can’t be changed here.', 'لا يمكن تغيير البريد الإلكتروني من هنا.')}
          </span>
        </label>

        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('Save changes', 'حفظ التغييرات')}
        </button>
      </form>
    </div>
  );
}
