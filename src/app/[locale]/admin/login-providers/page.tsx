import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { getSocialAuthFormValues } from '@/lib/social-auth';
import { inputCls, SubmitButton } from '@/components/admin/ui';
import { saveGoogleAuthAction, saveFacebookAuthAction, saveAppleAuthAction, clearSocialAuthAction } from '@/server/social-auth-actions';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

export default async function LoginProvidersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const fv = await getSocialAuthFormValues();
  const h = await headers();
  const host = h.get('host') ?? 'veeey.com';
  const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0];
  const origin = `${proto}://${host}`;
  const callback = (id: string) => `${origin}/api/auth/callback/${id}`;

  const banner = sp.saved ? tb('Saved.', 'تم الحفظ.') : sp.cleared ? tb('Cleared.', 'تم المسح.') : sp.error ? tb('Save failed.', 'تعذّر الحفظ.') : null;
  const bannerTone = sp.error ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary';

  const label = 'block text-sm font-medium text-foreground';
  const card = 'rounded-xl border border-border bg-card p-5';
  const callbackBox = `${inputCls} cursor-text bg-muted font-mono text-xs`;

  const oauth = [
    {
      id: 'google' as const,
      name: 'Google',
      action: saveGoogleAuthAction,
      idLabel: tb('Client ID', 'معرّف العميل'),
      secretLabel: tb('Client secret', 'سر العميل'),
      v: fv.google,
      hint: tb('Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application).', 'Google Cloud Console ← بيانات الاعتماد ← معرّف عميل OAuth (تطبيق ويب).'),
    },
    {
      id: 'facebook' as const,
      name: 'Facebook',
      action: saveFacebookAuthAction,
      idLabel: tb('App ID', 'معرّف التطبيق'),
      secretLabel: tb('App secret', 'سر التطبيق'),
      v: fv.facebook,
      hint: tb('Meta for Developers → your app → Facebook Login → Settings → Valid OAuth Redirect URIs.', 'Meta for Developers ← تطبيقك ← Facebook Login ← الإعدادات ← روابط إعادة التوجيه.'),
    },
  ];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Social login', 'تسجيل الدخول الاجتماعي')}</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Let customers sign in with Google, Facebook or Apple. Create an app in each provider’s console, paste the credentials below, and add the callback URL shown for each. Secrets are stored securely and never displayed again.',
          'اسمح للعملاء بتسجيل الدخول عبر Google أو Facebook أو Apple. أنشئ تطبيقًا في لوحة كل مزوّد، والصق بيانات الاعتماد أدناه، وأضف رابط الاستدعاء الظاهر لكل مزوّد. تُخزَّن الأسرار بأمان ولا تُعرض مرة أخرى.',
        )}
      </p>
      {banner && <div className={`mb-5 max-w-2xl rounded-lg px-3 py-2 text-sm ${bannerTone}`}>{banner}</div>}

      <div className="grid max-w-2xl gap-5">
        {oauth.map((p) => {
          const configured = !!p.v.clientId && p.v.hasSecret;
          return (
            <section key={p.id} className={card}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">{p.name}</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${configured ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {configured ? tb('Configured', 'مُهيّأ') : tb('Not set', 'غير مهيّأ')}
                </span>
              </div>
              <form action={p.action} className="space-y-3">
                <input type="hidden" name="locale" value={locale} />
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" name="enabled" defaultChecked={p.v.enabled} className="size-4" />
                  {tb('Enabled (show on login)', 'مُفعّل (يظهر في تسجيل الدخول)')}
                </label>
                <label className={label}>
                  {p.idLabel}
                  <input name="clientId" defaultValue={p.v.clientId} autoComplete="off" className={inputCls} />
                </label>
                <label className={label}>
                  {p.secretLabel}
                  <input name="clientSecret" type="password" autoComplete="off" placeholder={p.v.hasSecret ? '•••••••• ' + tb('(set — leave blank to keep)', '(محفوظ — اتركه فارغًا للإبقاء)') : ''} className={inputCls} />
                </label>
                <div>
                  <span className={label}>{tb('Callback URL (add this in the provider console)', 'رابط الاستدعاء (أضِفه في لوحة المزوّد)')}</span>
                  <input readOnly value={callback(p.id)} className={callbackBox} />
                </div>
                <p className="text-xs text-muted-foreground">{p.hint}</p>
                <div className="flex items-center gap-3 pt-1">
                  <SubmitButton>{tb('Save', 'حفظ')}</SubmitButton>
                </div>
              </form>
              {configured && (
                <form action={clearSocialAuthAction} className="mt-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="provider" value={p.id} />
                  <button className="text-xs font-medium text-destructive hover:underline">{tb('Clear credentials', 'مسح البيانات')}</button>
                </form>
              )}
            </section>
          );
        })}

        {/* Apple — Services ID + Team ID + Key ID + .p8 private key (secret auto-generated). */}
        <section className={card}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Apple</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${fv.apple.servicesId && fv.apple.hasKey ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {fv.apple.servicesId && fv.apple.hasKey ? tb('Configured', 'مُهيّأ') : tb('Not set', 'غير مهيّأ')}
            </span>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            {tb(
              'Apple Developer → Certificates, Identifiers & Profiles. Create a Services ID, a Sign in with Apple Key (.p8), and note your Team ID + Key ID. We generate the client secret automatically — no renewal needed.',
              'Apple Developer ← الشهادات والمعرّفات. أنشئ Services ID ومفتاح تسجيل الدخول عبر Apple (‎.p8‎)، ودوّن Team ID وKey ID. ننشئ سر العميل تلقائيًا — دون حاجة للتجديد.',
            )}
          </p>
          <form action={saveAppleAuthAction} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="enabled" defaultChecked={fv.apple.enabled} className="size-4" />
              {tb('Enabled (show on login)', 'مُفعّل (يظهر في تسجيل الدخول)')}
            </label>
            <label className={label}>
              {tb('Services ID (client ID)', 'Services ID (معرّف العميل)')}
              <input name="servicesId" defaultValue={fv.apple.servicesId} autoComplete="off" placeholder="com.veeey.web" className={inputCls} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                {tb('Team ID', 'Team ID')}
                <input name="teamId" defaultValue={fv.apple.teamId} autoComplete="off" className={inputCls} />
              </label>
              <label className={label}>
                {tb('Key ID', 'Key ID')}
                <input name="keyId" defaultValue={fv.apple.keyId} autoComplete="off" className={inputCls} />
              </label>
            </div>
            <label className={label}>
              {tb('Private key (.p8 contents)', 'المفتاح الخاص (محتوى ‎.p8‎)')}
              <textarea name="privateKey" rows={4} autoComplete="off" placeholder={fv.apple.hasKey ? '•••••••• ' + tb('(set — leave blank to keep)', '(محفوظ — اتركه فارغًا للإبقاء)') : '-----BEGIN PRIVATE KEY-----'} className={`${inputCls} font-mono text-xs`} />
            </label>
            <div>
              <span className={label}>{tb('Callback URL (Return URL in the provider console)', 'رابط الاستدعاء (Return URL في لوحة المزوّد)')}</span>
              <input readOnly value={callback('apple')} className={callbackBox} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <SubmitButton>{tb('Save', 'حفظ')}</SubmitButton>
            </div>
          </form>
          {fv.apple.servicesId && fv.apple.hasKey && (
            <form action={clearSocialAuthAction} className="mt-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="provider" value="apple" />
              <button className="text-xs font-medium text-destructive hover:underline">{tb('Clear credentials', 'مسح البيانات')}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
