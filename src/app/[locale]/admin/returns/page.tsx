import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { listReturns } from '@/lib/return-service';
import { returnsAnalytics, cancelledAwaitingReturn, refundQueue, hubCounts, HUB_CAP } from '@/lib/returns-hub';
import type { SP } from '@/lib/admin-list';

export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
type Tab = 'analytics' | 'cancelled' | 'returned' | 'refunds';
const TABS: Tab[] = ['analytics', 'cancelled', 'returned', 'refunds'];
const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'QUARANTINE', 'RESTOCKED', 'WRITTEN_OFF', 'REFUNDED', 'REJECTED'];

type CustomerRef = { firstName: string | null; lastName: string | null; user: { email: string | null } | null } | null;
const person = (c: CustomerRef, guest: string) => (c ? [c.firstName, c.lastName].filter(Boolean).join(' ') || c.user?.email || '—' : guest);

export default async function ReturnsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('returns.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const tab: Tab = (TABS as string[]).includes(one(sp.tab) ?? '') ? (one(sp.tab) as Tab) : 'analytics';
  const counts = await hubCounts();

  const tabMeta: { key: Tab; label: string; badge?: number }[] = [
    { key: 'analytics', label: tb('Analytics', 'التحليلات') },
    { key: 'cancelled', label: tb('Cancelled — awaiting return', 'ملغاة — بانتظار الإرجاع'), badge: counts.cancelled },
    { key: 'returned', label: tb('Returned', 'المرتجعات') },
    { key: 'refunds', label: tb('Needs refund', 'بانتظار الاسترداد'), badge: counts.needsRefund },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-heading text-xl font-semibold text-foreground">{tb('Returns & reverse logistics', 'المرتجعات واللوجستيات العكسية')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tb('Cancelled shipments to recover, customer returns to process, and refunds owed — in one place.', 'شحنات ملغاة يجب استردادها، ومرتجعات العملاء، والمبالغ المستحقة الاسترداد — في مكان واحد.')}</p>
      </div>

      {/* Tab nav — a shareable ?tab= link, not client state (each tab is server-rendered). */}
      <div className="mb-5 flex flex-wrap gap-1 border-b border-border">
        {tabMeta.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/admin/returns?tab=${t.key}`}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              aria-current={active ? 'page' : undefined}
            >
              {t.label}
              {t.badge ? <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{t.badge}</span> : null}
            </Link>
          );
        })}
      </div>

      {tab === 'analytics' && <AnalyticsTab tb={tb} />}
      {tab === 'cancelled' && <CancelledTab tb={tb} />}
      {tab === 'returned' && <ReturnedTab locale={locale} tb={tb} sp={sp} />}
      {tab === 'refunds' && <RefundsTab locale={locale} tb={tb} />}
    </div>
  );
}

// ---- shared bits ----------------------------------------------------------
type TB = (en: string, ar: string) => string;

function Table({ head, empty, children }: { head: string[]; empty?: string; children: ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) && rows.length === 0;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isEmpty ? <tr><td colSpan={head.length} className="px-3 py-8 text-center text-muted-foreground">{empty}</td></tr> : rows}
        </tbody>
      </table>
    </div>
  );
}
const td = 'px-3 py-2 align-middle';
const orderLink = (id: string, number: string) => <Link href={`/admin/orders/${id}`} className="font-medium text-primary hover:underline">{number}</Link>;
const CapNote = ({ n, tb }: { n: number; tb: TB }) => (n >= HUB_CAP ? <p className="mt-2 text-xs text-muted-foreground">{tb(`Showing the first ${HUB_CAP}. Use the linked order/return pages to work through the rest.`, `عرض أول ${HUB_CAP}. استخدم صفحات الطلب/الإرجاع لمتابعة الباقي.`)}</p> : null);

// ---- Tab 1: Analytics -----------------------------------------------------
async function AnalyticsTab({ tb }: { tb: TB }) {
  const a = await returnsAnalytics();
  const cards = [
    { label: tb('Total returns', 'إجمالي المرتجعات'), value: a.totalReturns.toLocaleString('en-US') },
    { label: tb('Cancelled — awaiting return', 'ملغاة بانتظار الإرجاع'), value: a.cancelledOpen.toLocaleString('en-US'), href: '/admin/returns?tab=cancelled' },
    { label: tb('Needs refund', 'بانتظار الاسترداد'), value: a.needsRefund.toLocaleString('en-US'), href: '/admin/returns?tab=refunds' },
    { label: tb('Refunds paid', 'المبالغ المستردة'), value: formatEGP(Number(a.refundSum)), sub: `${a.refundCount} ${tb('refunds', 'استرداد')}` },
    { label: tb('Return rate (90d)', 'معدل الإرجاع (٩٠ يوم)'), value: `${a.ratePct}%`, sub: `${a.recentReturns}/${a.recentOrders} ${tb('orders', 'طلب')}` },
  ];
  const maxReason = Math.max(1, ...a.topReasons.map((r) => r.count));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const inner = (
            <>
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{c.value}</div>
              <div className="text-[11px] text-muted-foreground">{c.sub ?? ' '}</div>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary">{inner}</Link>
          ) : (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{tb('Returns by status', 'المرتجعات حسب الحالة')}</h2>
          {RETURN_STATUSES.every((s) => !a.statusCounts[s]) ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{tb('No returns yet.', 'لا توجد مرتجعات بعد.')}</p>
          ) : (
            <ul className="space-y-1.5">
              {RETURN_STATUSES.filter((s) => a.statusCounts[s]).map((s) => (
                <li key={s} className="flex items-center justify-between gap-3 text-sm">
                  <StatusBadge status={s} />
                  <span className="font-medium text-foreground">{a.statusCounts[s]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{tb('Top return reasons', 'أكثر أسباب الإرجاع')}</h2>
          {a.topReasons.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{tb('No reasons recorded yet.', 'لا توجد أسباب مسجّلة بعد.')}</p>
          ) : (
            <ul className="space-y-2">
              {a.topReasons.map((r) => (
                <li key={r.reason}>
                  <div className="mb-0.5 flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-foreground">{r.reason}</span>
                    <span className="font-medium text-muted-foreground">{r.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / maxReason) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Tab 2: Cancelled, awaiting return ------------------------------------
async function CancelledTab({ tb }: { tb: TB }) {
  const orders = await cancelledAwaitingReturn();
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">{tb('Orders that shipped (courier/AWB assigned) and were then cancelled, with nothing returned to stock yet — the goods are still out.', 'طلبات تم شحنها (بمندوب/بوليصة) ثم أُلغيت، ولم يُعَد أي شيء للمخزون بعد — البضاعة ما زالت خارجة.')}</p>
      <Table
        head={[tb('Order', 'الطلب'), tb('Customer', 'العميل'), tb('Total', 'الإجمالي'), tb('Payment', 'الدفع'), tb('Courier', 'المندوب'), tb('Tracking', 'التتبّع'), tb('Cancelled', 'أُلغي')]}
        empty={tb('Nothing outstanding — every cancelled shipment is back.', 'لا يوجد معلّق — كل شحنة ملغاة عادت.')}
      >
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-muted/30">
            <td className={td}>{orderLink(o.id, o.number)}</td>
            <td className={td}>{person(o.customer, o.guestEmail ?? tb('Guest', 'زائر'))}</td>
            <td className={td}>{formatEGP(Number(o.totalPiastres))}</td>
            <td className={td}><span className="text-xs text-muted-foreground">{o.paymentState}</span></td>
            <td className={td}>{o.courier ?? '—'}</td>
            <td className={td}><span className="text-xs">{o.trackingNumber ?? '—'}</span></td>
            <td className={td}>{o.updatedAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </Table>
      <CapNote n={orders.length} tb={tb} />
    </div>
  );
}

// ---- Tab 3: Returned (customer returns register) --------------------------
async function ReturnedTab({ locale, tb, sp }: { locale: string; tb: TB; sp: SP }) {
  const q = one(sp.q);
  const status = one(sp.status);
  const rows = await listReturns({ q, status });
  const reasonText = (r: (typeof rows)[number]) => (r.reason ? (locale === 'ar' ? r.reason.labelAr : r.reason.labelEn) : r.reasonCode) || '—';
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* keep the tab when searching/filtering */}
        <form className="flex items-center gap-2" action="/admin/returns" method="get">
          <input type="hidden" name="tab" value="returned" />
          <input name="q" defaultValue={q ?? ''} placeholder={tb('Order # or customer', 'رقم الطلب أو العميل')} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('Search', 'بحث')}</button>
        </form>
        <div className="flex flex-wrap gap-1">
          <Link href={`/admin/returns?tab=returned${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={`rounded-full border px-2.5 py-1 text-xs ${!status ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{tb('All', 'الكل')}</Link>
          {RETURN_STATUSES.map((s) => (
            <Link key={s} href={`/admin/returns?tab=returned&status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={`rounded-full border px-2.5 py-1 text-xs ${status === s ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{s}</Link>
          ))}
        </div>
        <Link href="/admin/returns/reasons" className="ms-auto text-sm text-primary hover:underline">{tb('Manage reasons', 'إدارة الأسباب')}</Link>
      </div>
      <Table
        head={[tb('Order', 'الطلب'), tb('Customer', 'العميل'), tb('Reason', 'السبب'), tb('Items', 'العناصر'), tb('Status', 'الحالة'), tb('Date', 'التاريخ'), '']}
        empty={tb('No returns match.', 'لا توجد مرتجعات مطابقة.')}
      >
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-muted/30">
            <td className={td}>{orderLink(r.order.id, r.order.number)}</td>
            <td className={td}>{person(r.customer, tb('Guest', 'زائر'))}</td>
            <td className={td}>{r.reasonNote ? `${reasonText(r)} — ${r.reasonNote}` : reasonText(r)}</td>
            <td className={td}>{r.items.length}</td>
            <td className={td}><StatusBadge status={r.status} /></td>
            <td className={td}>{r.createdAt.toISOString().slice(0, 10)}</td>
            <td className={td}><Link href={`/admin/returns/${r.id}`} className="text-sm text-primary hover:underline">{tb('Open', 'فتح')}</Link></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

// ---- Tab 4: Needs refund + history ----------------------------------------
async function RefundsTab({ locale, tb }: { locale: string; tb: TB }) {
  const { needsRefund, refunded } = await refundQueue();
  const reasonText = (r: { reason: { labelEn: string; labelAr: string } | null; reasonCode: string }) => (r.reason ? (locale === 'ar' ? r.reason.labelAr : r.reason.labelEn) : r.reasonCode) || '—';
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 text-sm font-semibold text-foreground">{tb('Action needed — refund owed', 'إجراء مطلوب — استرداد مستحق')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{tb('The customer paid and the return is received, but no refund has been recorded yet. Open the return to issue it.', 'دفع العميل وتم استلام المرتجع، لكن لم يُسجَّل أي استرداد بعد. افتح المرتجع لإصداره.')}</p>
        <Table
          head={[tb('Order', 'الطلب'), tb('Customer', 'العميل'), tb('Reason', 'السبب'), tb('Order total', 'إجمالي الطلب'), tb('Payment', 'الدفع'), tb('Return', 'المرتجع'), '']}
          empty={tb('No refunds are currently owed.', 'لا توجد مبالغ مستحقة الاسترداد حاليًا.')}
        >
          {needsRefund.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30">
              <td className={td}>{orderLink(r.order.id, r.order.number)}</td>
              <td className={td}>{person(r.customer, tb('Guest', 'زائر'))}</td>
              <td className={td}>{reasonText(r)}</td>
              <td className={td}>{formatEGP(Number(r.order.totalPiastres))}</td>
              <td className={td}><span className="text-xs text-muted-foreground">{r.order.paymentState}</span></td>
              <td className={td}><StatusBadge status={r.status} /></td>
              <td className={td}><Link href={`/admin/returns/${r.id}`} className="text-sm font-medium text-primary hover:underline">{tb('Refund', 'استرداد')}</Link></td>
            </tr>
          ))}
        </Table>
        <CapNote n={needsRefund.length} tb={tb} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{tb('Refund history', 'سجلّ المبالغ المستردة')}</h2>
        <Table
          head={[tb('Order', 'الطلب'), tb('Customer', 'العميل'), tb('Reason', 'السبب'), tb('Refunded', 'المبلغ المسترد'), tb('Method', 'الطريقة'), tb('Status', 'الحالة'), tb('Date', 'التاريخ')]}
          empty={tb('No refunds issued yet.', 'لم يتم إصدار أي استرداد بعد.')}
        >
          {refunded.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30">
              <td className={td}>{orderLink(r.order.id, r.order.number)}</td>
              <td className={td}>{person(r.customer, tb('Guest', 'زائر'))}</td>
              <td className={td}>{reasonText(r)}</td>
              <td className={td}>{r.refundPiastres != null ? formatEGP(Number(r.refundPiastres)) : '—'}</td>
              <td className={td}><span className="text-xs text-muted-foreground">{r.refundMethod ?? '—'}</span></td>
              <td className={td}><StatusBadge status={r.status} /></td>
              <td className={td}>{r.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </Table>
        <CapNote n={refunded.length} tb={tb} />
      </section>
    </div>
  );
}
