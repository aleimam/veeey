import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getCustomerAdmin } from '@/lib/customer-admin-service';
import { listLoyaltyTransactions } from '@/lib/loyalty-service';
import { formatEGP } from '@/lib/format';
import { GOVERNORATES } from '@/lib/governorates';
import { shoppingStyleLabel, productsTypeLabel } from '@/lib/order-traits';
import { StatusBadge } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { Pencil } from 'lucide-react';

const govLabel = (en: string, locale: string) => {
  const g = GOVERNORATES.find((x) => x.en === en);
  return g ? (locale === 'ar' ? g.ar : g.en) : en;
};

/** Read-only customer DETAILS page (owner batch 2026-07-23). All editing moved to
 *  /admin/customers/[id]/edit — this page is a clean, scannable overview with an
 *  "Edit" button. Viewing needs customers.read; the Edit button is shown only to
 *  users who also hold customers.write. */
export default async function CustomerDetailsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const user = await requirePermission('customers.read');
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const canEdit = hasPermission(user.permissions, 'customers.write');

  const c = await getCustomerAdmin(id);
  if (!c) notFound();
  const loyaltyTxns = await listLoyaltyTransactions(id);

  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.user.name || c.user.email || tb('Customer', 'عميل');
  const dateFmt = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB') : null);
  const statusChip = { ACTIVE: 'bg-primary/10 text-primary', FLAGGED: 'bg-gold/15 text-gold', BLOCKED: 'bg-destructive/10 text-destructive' }[c.status] ?? 'bg-muted text-muted-foreground';
  const statusLabel = { ACTIVE: tb('Active', 'نشط'), FLAGGED: tb('Flagged', 'مُعلَّم'), BLOCKED: tb('Blocked', 'محظور') }[c.status] ?? c.status;
  const yesNo = (v: boolean) => (v ? tb('Yes', 'نعم') : tb('No', 'لا'));

  return (
    <div className="p-6">
      <Link href="/admin/customers" className="text-sm text-primary hover:underline">← {tb('Customers', 'العملاء')}</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusChip}`}>{statusLabel}</span>
            {c.tier && <span>{c.tier.nameEn}</span>}
            <span>· {c.pointsBalance.toLocaleString('en-US')} {tb('pts', 'نقطة')}</span>
            <span>· {formatEGP(Number(c.lifetimeSpendPiastres))} {tb('lifetime', 'إجمالي')}</span>
          </div>
        </div>
        {canEdit && (
          <Link href={`/admin/customers/${c.id}/edit`} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Pencil size={15} /> {tb('Edit customer', 'تعديل العميل')}
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tb('Contact', 'التواصل')}>
          <Row label={tb('Email', 'البريد')}>{c.user.email ?? '—'}</Row>
          <Row label={tb('Primary phone', 'الهاتف الأساسي')}>{c.user.phone ?? '—'}</Row>
          <Row label={tb('Email verified', 'تأكيد البريد')}>{c.user.emailVerified ? `✓ ${dateFmt(c.user.emailVerified)}` : tb('Not verified', 'غير مؤكد')}</Row>
          <Row label={tb('Phone verified', 'تأكيد الهاتف')}>{c.user.phoneVerified ? `✓ ${dateFmt(c.user.phoneVerified)}` : tb('Not verified', 'غير مؤكد')}</Row>
        </Card>

        <Card title={tb('Membership', 'العضوية')}>
          <Row label={tb('Tier', 'الفئة')}>{c.tier?.nameEn ?? tb('None', 'بدون')}</Row>
          <Row label={tb('Tier lock', 'قفل الفئة')}>{c.tierManual ? tb('Locked', 'مقفلة') : tb('Auto (by spend)', 'تلقائي (حسب الإنفاق)')}{c.tierManual && c.tierManualUntil ? ` · ${tb('until', 'حتى')} ${dateFmt(c.tierManualUntil)}` : ''}</Row>
          <Row label={tb('Points balance', 'رصيد النقاط')}>{c.pointsBalance.toLocaleString('en-US')}</Row>
          <Row label={tb('Lifetime spend', 'إجمالي الإنفاق')}>{formatEGP(Number(c.lifetimeSpendPiastres))}</Row>
          <Row label={tb('Shopping Style', 'أسلوب الشراء')}>{shoppingStyleLabel(c.shoppingStyle, locale) ?? '—'}</Row>
          <Row label={tb('Products type', 'نوع المنتجات')}>{productsTypeLabel(c.productsType, locale) ?? '—'}</Row>
        </Card>

        <Card title={tb('Marketing', 'التسويق')}>
          <Row label={tb('Email marketing', 'تسويق البريد')}>{yesNo(c.marketingConsent)}</Row>
          <Row label={tb('SMS marketing', 'تسويق الرسائل')}>{yesNo(c.marketingSmsConsent)}</Row>
        </Card>

        <Card title={tb('Internal notes', 'ملاحظات داخلية')}>
          {c.adminNotes ? <p className="whitespace-pre-wrap text-sm text-foreground">{c.adminNotes}</p> : <p className="text-sm text-muted-foreground">{tb('No notes.', 'لا توجد ملاحظات.')}</p>}
        </Card>
      </div>

      {/* Loyalty activity */}
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Loyalty points', 'نقاط الولاء')}</h2>
        <div className="rounded-lg border border-border p-4">
          <p className="mb-3 text-sm"><span className="text-2xl font-semibold text-foreground">{c.pointsBalance.toLocaleString('en-US')}</span> <span className="text-muted-foreground">{tb('points', 'نقطة')}</span></p>
          {loyaltyTxns.length > 0 ? (
            <ul className="space-y-1 border-t border-border pt-3 text-sm">
              {loyaltyTxns.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    <span className={t.points >= 0 ? 'font-medium text-primary' : 'font-medium text-destructive'}>{t.points >= 0 ? '+' : ''}{t.points}</span>
                    {' '}· {t.type}{t.order ? ` · #${t.order.number}` : ''}{t.note ? ` · ${t.note}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">{dateFmt(t.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{tb('No points activity yet.', 'لا يوجد نشاط نقاط بعد.')}</p>
          )}
        </div>
      </section>

      {/* Addresses (read-only) */}
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Addresses', 'العناوين')} ({c.addresses.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-start">{tb('Governorate', 'المحافظة')}</th>
                <th className="p-2 text-start">{tb('City', 'المدينة')}</th>
                <th className="p-2 text-start">{tb('Area', 'المنطقة')}</th>
                <th className="p-2 text-start">{tb('Street', 'الشارع')}</th>
                <th className="p-2 text-start">{tb('Building', 'المبنى')}</th>
                <th className="p-2 text-start">{tb('Phone', 'الهاتف')}</th>
                <th className="p-2 text-center">{tb('Default', 'افتراضي')}</th>
              </tr>
            </thead>
            <tbody>
              {c.addresses.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-2">{govLabel(a.governorate, locale)}</td>
                  <td className="p-2">{a.city}</td>
                  <td className="p-2">{a.area || '—'}</td>
                  <td className="p-2">{a.street || '—'}</td>
                  <td className="p-2">{a.building || '—'}</td>
                  <td className="p-2">{a.phone || '—'}</td>
                  <td className="p-2 text-center">{a.isDefaultShipping ? '✓' : ''}</td>
                </tr>
              ))}
              {c.addresses.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{tb('No saved addresses yet.', 'لا توجد عناوين محفوظة بعد.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent orders */}
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Recent orders', 'أحدث الطلبات')}</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{tb('Number', 'الرقم')}</th>
                <th className="p-3 text-start">{tb('Date', 'التاريخ')}</th>
                <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
                <th className="p-3 text-start">{tb('Total', 'الإجمالي')}</th>
              </tr>
            </thead>
            <tbody>
              {c.orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.number}</Link></td>
                  <td className="p-3 text-muted-foreground">{dateFmt(o.placedAt)}</td>
                  <td className="p-3"><StatusBadge status={o.status} /></td>
                  <td className="p-3">{formatEGP(Number(o.totalPiastres))}</td>
                </tr>
              ))}
              {c.orders.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{tb('No orders yet.', 'لا توجد طلبات بعد.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium text-foreground">{children}</dd>
    </div>
  );
}
