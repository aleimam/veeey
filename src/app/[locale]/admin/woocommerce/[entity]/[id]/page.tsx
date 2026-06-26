import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { wooFetchOne, WOO_ENTITY_ENDPOINT } from '@/lib/woocommerce';

export const dynamic = 'force-dynamic';

const s = (v: unknown): string => (v == null ? '' : typeof v === 'object' ? '' : String(v));
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const humanize = (k: string) => k.replace(/_/g, ' ');
const stripHtml = (str: string) => str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const SKIP = new Set(['_links']);
const chip = 'inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-foreground';

function renderValue(key: string, v: unknown): React.ReactNode {
  if (v == null || v === '') return <span className="text-muted-foreground">—</span>;

  // Images → thumbnails
  if (key === 'images' && Array.isArray(v)) {
    return (
      <div className="flex flex-wrap gap-2">
        {v.map((x, i) => {
          const src = s(obj(x).src);
          return src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="size-16 rounded-md border border-border object-contain" />
          ) : null;
        })}
      </div>
    );
  }
  if ((key === 'image' || key === 'avatar_url') && (typeof v === 'string' || obj(v).src)) {
    const src = typeof v === 'string' ? v : s(obj(v).src);
    // eslint-disable-next-line @next/next/no-img-element
    return src ? <img src={src} alt="" className="size-16 rounded-md border border-border object-contain" /> : <span className="text-muted-foreground">—</span>;
  }

  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const clean = v.includes('<') ? stripHtml(v) : v;
    return clean.length > 600 ? `${clean.slice(0, 600)}…` : clean || <span className="text-muted-foreground">—</span>;
  }

  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground">—</span>;
    if (key === 'meta_data') return <span className="text-muted-foreground">{v.length} entries</span>;
    if (typeof v[0] === 'object') {
      return (
        <div className="flex flex-wrap gap-1.5">
          {v.map((x, i) => {
            const o = obj(x);
            const opts = Array.isArray(o.options) ? o.options.map((y) => s(y)).filter(Boolean).join(', ') : '';
            const label = o.name && opts ? `${s(o.name)}: ${opts}` : s(o.name ?? o.code ?? o.title ?? o.key ?? o.id ?? JSON.stringify(x));
            return <span key={i} className={chip}>{label}</span>;
          })}
        </div>
      );
    }
    return v.map((x) => s(x)).join(', ');
  }

  // Plain object → one-level key/value
  const o = obj(v);
  const entries = Object.entries(o).filter(([, val]) => val != null && val !== '');
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map(([k, val]) => (
        <div key={k} className="text-sm">
          <span className="text-muted-foreground">{humanize(k)}: </span>
          <span className="text-foreground">{typeof val === 'object' ? JSON.stringify(val) : s(val)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function WooDetailPage({ params }: { params: Promise<{ locale: string; entity: string; id: string }> }) {
  const { locale, entity, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const endpoint = WOO_ENTITY_ENDPOINT[entity];
  if (!endpoint) notFound();

  let record: Record<string, unknown> | null = null;
  let error: string | null = null;
  try {
    record = await wooFetchOne(endpoint, id);
  } catch (e) {
    error = e instanceof Error ? e.message : 'ERROR';
  }
  if (!record && !error) notFound();

  const title = record
    ? s(record.name) || s(record.code) || s(record.email) || (record.number ? `#${s(record.number)}` : '') || `#${s(record.id)}`
    : `#${id}`;
  const fields = record ? Object.entries(record).filter(([k]) => !SKIP.has(k)) : [];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/admin/woocommerce" className="text-muted-foreground hover:text-foreground">{tb('Egypt Vitamins', 'إيجيبت فيتامينز')}</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/admin/woocommerce/${entity}`} className="text-muted-foreground hover:text-foreground">{entity}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">{title}</span>
      </div>

      <h1 className="mb-4 font-heading text-xl font-semibold text-foreground">{title}</h1>

      {error ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
          {error === 'WOO_NOT_CONFIGURED'
            ? <>{tb('Not connected. ', 'لم يتم الاتصال. ')}<Link href="/admin/woocommerce" className="font-medium underline">{tb('Set up the connection', 'إعداد الاتصال')}</Link></>
            : <>{tb('Could not load', 'تعذّر التحميل')}: <span className="font-mono text-xs">{error}</span></>}
        </div>
      ) : (
        <div className="max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
          {fields.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-3 sm:grid-cols-[200px_1fr] sm:gap-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:pt-0.5">{humanize(k)}</div>
              <div className="min-w-0 break-words text-sm text-foreground">{renderValue(k, v)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
