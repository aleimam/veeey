import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { getIncomingShipment } from '@/lib/incoming-shipment-service';
import { approveShipmentAction, rejectShipmentAction } from '@/server/incoming-shipment-actions';
import { SubmitButton, inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

export default async function IncomingShipmentDetail({
  params, searchParams,
}: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<SP> }) {
  await requirePermission('inventory.manage');
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const s = await getIncomingShipment(id);
  if (!s) notFound();

  const pending = s.status === 'PENDING_REVIEW';
  const units = s.lots.reduce((n, l) => n + l.quantity, 0);
  const unmatched = s.lots.filter((l) => !l.productId).length;
  const noExpiry = s.lots.filter((l) => !l.expiryDate).length;

  const err = one(sp.error);
  const banner = one(sp.approved) ? tb('Approved.', 'تم الاعتماد.')
    : one(sp.rejected) ? tb('Sent back for correction.', 'أُعيدت للتصحيح.')
    : err === 'reason_required' ? tb('A reason is required to send it back.', 'يلزم ذكر سبب لإعادتها.')
    : err ? tb('That shipment is no longer pending.', 'لم تعد هذه الشحنة في انتظار المراجعة.')
    : null;

  const card = 'rounded-xl border border-border bg-card p-5';

  return (
    <div className="p-4 sm:p-6">
      <Link href="/admin/inventory/incoming" className="text-sm text-primary hover:underline">
        ← {tb('Incoming shipments', 'الشحنات الواردة')}
      </Link>
      <h1 className="mb-1 mt-2 font-heading text-xl font-semibold text-foreground">{s.yeldninUid}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {tb('Received', 'استُلمت')} {day(s.receivedAt)} · {units} {tb('units', 'وحدة')} · {s.lots.length} {tb('lots', 'تشغيلة')}
      </p>

      {banner && <div className="mb-5 max-w-4xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{banner}</div>}

      {/* Approval is a judgement call, so surface what makes it risky rather than
          letting it look uniformly fine. */}
      {pending && (unmatched > 0 || noExpiry > 0) && (
        <div className="mb-5 max-w-4xl rounded-lg bg-gold/15 px-3 py-2 text-sm text-slate">
          {unmatched > 0 && <div>{tb(`${unmatched} lot(s) match no product in the catalog — they cannot be stocked.`, `${unmatched} تشغيلة لا تطابق أي منتج في الكتالوج — لا يمكن إضافتها للمخزون.`)}</div>}
          {noExpiry > 0 && <div>{tb(`${noExpiry} lot(s) have no expiry date.`, `${noExpiry} تشغيلة بدون تاريخ صلاحية.`)}</div>}
        </div>
      )}

      <div className="grid max-w-6xl gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className={card}>
          <h2 className="mb-3 text-base font-semibold text-foreground">{tb('What arrived', 'ما تم استلامه')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{tb('Product', 'المنتج')}</th>
                  <th className="p-2 text-start">{tb('Expiry', 'الصلاحية')}</th>
                  <th className="p-2 text-start">{tb('Lot', 'التشغيلة')}</th>
                  <th className="p-2 text-end">{tb('Qty', 'الكمية')}</th>
                  <th className="p-2 text-end">{tb('Unit cost', 'تكلفة الوحدة')}</th>
                </tr>
              </thead>
              <tbody>
                {s.lots.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="p-2">
                      <span className={l.productId ? 'text-foreground' : 'text-destructive'}>{l.productName}</span>
                      {!l.productId && <span className="ms-1.5 text-xs text-destructive">({tb('unmatched', 'غير مطابق')})</span>}
                      {l.sku && <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>}
                    </td>
                    <td className="whitespace-nowrap p-2">{day(l.expiryDate)}</td>
                    <td className="p-2 text-muted-foreground">{l.lotCode ?? '—'}</td>
                    <td className="p-2 text-end">{l.quantity}</td>
                    <td className="whitespace-nowrap p-2 text-end text-muted-foreground">
                      {l.unitCost != null ? `${l.unitCost} ${l.currency ?? 'EGP'}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {tb('Costs are the supplier figures as entered. Conversion to EGP happens on approval, at that day’s rate.',
                'التكاليف كما أدخلها المورّد. يتم التحويل إلى الجنيه عند الاعتماد بسعر ذلك اليوم.')}
          </p>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-base font-semibold text-foreground">{tb('Photos', 'الصور')}</h2>
          {s.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tb('No photos were attached.', 'لم تُرفق أي صور.')}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {s.photos.map((p) => (
                <a key={p.id} href={`/api/admin/incoming-shipments/photo/${encodeURIComponent(p.assetId)}`} target="_blank" rel="noreferrer">
                  {/* Plain <img>: these bytes are proxied from YeldnIN through an
                      auth-gated API route, so next/image can't optimise them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/incoming-shipments/photo/${encodeURIComponent(p.assetId)}`}
                    alt={tb('Shipment photo', 'صورة الشحنة')}
                    className="h-32 w-32 rounded-lg border border-border object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-5 max-w-6xl">
        {pending ? (
          <div className={`${card} flex flex-wrap items-end gap-4`}>
            <form action={approveShipmentAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={s.id} />
              <SubmitButton>{tb('Approve', 'اعتماد')}</SubmitButton>
            </form>
            <form action={rejectShipmentAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={s.id} />
              <label className="text-xs text-muted-foreground">
                {tb('Send back — reason', 'إعادة — السبب')}
                <input name="reason" required className={`${inputCls} w-72`} placeholder={tb('What must Ops fix?', 'ما الذي يجب أن يصححه فريق العمليات؟')} />
              </label>
              <button className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10">
                {tb('Send back', 'إعادة')}
              </button>
            </form>
            <p className="w-full text-xs text-muted-foreground">
              {tb('Approving records the decision. Stock is not created yet — that step ships with the stock-master switch.',
                  'الاعتماد يسجّل القرار. لا يتم إنشاء المخزون بعد — تلك الخطوة تأتي مع تحويل مصدر المخزون.')}
            </p>
          </div>
        ) : (
          <div className={card}>
            <p className="text-sm text-foreground">
              {s.status === 'APPROVED' ? tb('Approved', 'معتمدة') : tb('Sent back for correction', 'أُعيدت للتصحيح')}
              {s.reviewedAt ? ` · ${day(s.reviewedAt)}` : ''}
            </p>
            {s.rejectReason && <p className="mt-1 text-sm text-muted-foreground">{s.rejectReason}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
