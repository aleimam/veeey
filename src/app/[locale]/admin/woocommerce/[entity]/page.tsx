import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { wooFetch, type WooEntity } from '@/lib/woocommerce';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
type Item = Record<string, unknown>;

const s = (v: unknown): string => (v == null ? '' : typeof v === 'object' ? '' : String(v));
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const d10 = (v: unknown): string => s(v).slice(0, 10);

type EntityConfig = { endpoint: WooEntity; title: [string, string]; headers: [string, string][]; row: (i: Item) => string[] };

const CONFIG: Record<string, EntityConfig> = {
  products: {
    endpoint: 'products',
    title: ['Products', 'المنتجات'],
    headers: [['ID', 'المعرّف'], ['Name', 'الاسم'], ['SKU', 'SKU'], ['Price', 'السعر'], ['Stock', 'المخزون'], ['Status', 'الحالة']],
    row: (i) => [s(i.id), s(i.name), s(i.sku), s(i.price), s(i.stock_quantity), s(i.status)],
  },
  customers: {
    endpoint: 'customers',
    title: ['Customers', 'العملاء'],
    headers: [['ID', 'المعرّف'], ['Email', 'البريد'], ['Name', 'الاسم'], ['City', 'المدينة'], ['Role', 'الدور'], ['Joined', 'انضمّ']],
    row: (i) => [s(i.id), s(i.email), `${s(i.first_name)} ${s(i.last_name)}`.trim(), s(obj(i.billing).city), s(i.role), d10(i.date_created)],
  },
  orders: {
    endpoint: 'orders',
    title: ['Orders', 'الطلبات'],
    headers: [['Order', 'الطلب'], ['Status', 'الحالة'], ['Total', 'الإجمالي'], ['Customer', 'العميل'], ['Date', 'التاريخ']],
    row: (i) => [`#${s(i.number)}`, s(i.status), `${s(i.total)} ${s(i.currency)}`.trim(), `${s(obj(i.billing).first_name)} ${s(obj(i.billing).last_name)}`.trim(), d10(i.date_created)],
  },
  categories: {
    endpoint: 'products/categories',
    title: ['Categories', 'الفئات'],
    headers: [['ID', 'المعرّف'], ['Name', 'الاسم'], ['Slug', 'المُعرّف اللطيف'], ['Products', 'المنتجات'], ['Parent', 'الأصل']],
    row: (i) => [s(i.id), s(i.name), s(i.slug), s(i.count), s(i.parent)],
  },
  coupons: {
    endpoint: 'coupons',
    title: ['Coupons', 'الكوبونات'],
    headers: [['Code', 'الكود'], ['Type', 'النوع'], ['Amount', 'القيمة'], ['Used', 'مرّات الاستخدام'], ['Expires', 'ينتهي']],
    row: (i) => [s(i.code), s(i.discount_type), s(i.amount), s(i.usage_count), d10(i.date_expires)],
  },
  reviews: {
    endpoint: 'products/reviews',
    title: ['Reviews', 'المراجعات'],
    headers: [['ID', 'المعرّف'], ['Product', 'المنتج'], ['Reviewer', 'المراجِع'], ['Rating', 'التقييم'], ['Status', 'الحالة'], ['Date', 'التاريخ']],
    row: (i) => [s(i.id), s(i.product_id), s(i.reviewer), s(i.rating), s(i.status), d10(i.date_created)],
  },
};

export default async function WooEntityPage({ params, searchParams }: { params: Promise<{ locale: string; entity: string }>; searchParams: Promise<SP> }) {
  const { locale, entity } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const cfg = CONFIG[entity];
  if (!cfg) notFound();

  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const perPage = 20;

  let rows: string[][] = [];
  let total = 0;
  let totalPages = 1;
  let error: string | null = null;
  try {
    const res = await wooFetch(cfg.endpoint, { page, per_page: perPage });
    rows = (res.data as Item[]).map(cfg.row);
    total = res.total;
    totalPages = res.totalPages;
  } catch (e) {
    error = e instanceof Error ? e.message : 'ERROR';
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/admin/woocommerce" className="text-muted-foreground hover:text-foreground">{tb('Egypt Vitamins', 'إيجيبت فيتامينز')}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">{tb(cfg.title[0], cfg.title[1])}</span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold text-foreground">{tb(cfg.title[0], cfg.title[1])}</h1>
        {!error && <span className="text-sm text-muted-foreground">{tb(`${total.toLocaleString('en-US')} total`, `${total.toLocaleString('en-US')} إجمالًا`)}</span>}
      </div>

      {error ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
          {error === 'WOO_NOT_CONFIGURED'
            ? <>{tb('Not connected yet. ', 'لم يتم الاتصال بعد. ')}<Link href="/admin/woocommerce" className="font-medium underline">{tb('Set up the connection', 'إعداد الاتصال')}</Link>.</>
            : <>{tb('Could not load from WooCommerce', 'تعذّر التحميل من ووكومرس')}: <span className="font-mono text-xs">{error}</span></>}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>{cfg.headers.map((h) => <th key={h[0]} className="p-3 text-start font-medium">{tb(h[0], h[1])}</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={cfg.headers.length} className="p-6 text-center text-muted-foreground">{tb('No rows.', 'لا توجد صفوف.')}</td></tr>}
                {rows.map((cells, r) => (
                  <tr key={r} className="border-t border-border">
                    {cells.map((c, ci) => <td key={ci} className={`p-3 ${ci === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{c || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{tb(`Page ${page} of ${totalPages}`, `صفحة ${page} من ${totalPages}`)}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/admin/woocommerce/${entity}?page=${page - 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Previous', 'السابق')}</Link>}
              {page < totalPages && <Link href={`/admin/woocommerce/${entity}?page=${page + 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Next', 'التالي')}</Link>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
