import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { listIncomingShipments } from '@/lib/incoming-shipment-service';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TABS = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const;

export default async function IncomingShipmentsPage({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('inventory.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const status = (TABS as readonly string[]).includes(one(sp.status) ?? '') ? one(sp.status)! : 'PENDING_REVIEW';
  const rows = await listIncomingShipments(status);

  const label = (s: string) =>
    s === 'PENDING_REVIEW' ? tb('Pending review', 'في انتظار المراجعة')
    : s === 'APPROVED' ? tb('Approved', 'معتمدة')
    : tb('Rejected', 'مرفوضة');

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Incoming shipments', 'الشحنات الواردة')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'Shipments received by Operations in YeldnIN. Check the entered expiry dates against the attached photos, then approve or send back for correction.',
          'الشحنات التي استلمها فريق العمليات في YeldnIN. راجع تواريخ الصلاحية المُدخلة مقابل الصور المرفقة، ثم اعتمدها أو أعِدها للتصحيح.',
        )}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/admin/inventory/incoming?status=${s}`}
            className={`rounded-full px-3 py-1 text-sm ${s === status ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-surface'}`}
          >
            {label(s)}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-start text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Shipment', 'الشحنة')}</th>
              <th className="p-3 text-start">{tb('Received', 'تاريخ الاستلام')}</th>
              <th className="p-3 text-start">{tb('Lots', 'التشغيلات')}</th>
              <th className="p-3 text-start">{tb('Photos', 'الصور')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-3">
                  <Link href={`/admin/inventory/incoming/${s.id}`} className="font-medium text-primary hover:underline">
                    {s.yeldninUid}
                  </Link>
                </td>
                <td className="whitespace-nowrap p-3 text-muted-foreground">{new Date(s.receivedAt).toISOString().slice(0, 10)}</td>
                <td className="p-3">{s._count.lots}</td>
                <td className="p-3">{s._count.photos}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  {tb('Nothing here.', 'لا يوجد شيء هنا.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
