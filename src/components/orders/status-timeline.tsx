import { statusLabel } from '@/lib/order-status-service';

/**
 * Durable order status timeline (Phase-1). Renders the append-only
 * OrderStatusHistory — the same data for staff and customers. Server component;
 * resolves bilingual labels from the live status config. RTL-safe (logical
 * padding + border, no left/right literals).
 */
export type TimelineEntry = {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: Date;
  actorName?: string | null; // shown to staff only
};

const fmt = (d: Date, locale: string) =>
  new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);

export async function StatusTimeline({
  entries,
  locale,
  showActor = false,
}: {
  entries: TimelineEntry[];
  locale: string;
  showActor?: boolean;
}) {
  if (!entries.length) return null;
  const heading = locale === 'ar' ? 'سجل حالة الطلب' : 'Order status history';
  const paymentRefunded = locale === 'ar' ? 'تم رد المبلغ' : 'Payment refunded';

  // Resolve labels once (PAYMENT_REFUNDED is a payment fact, not a real status).
  const rows = await Promise.all(
    entries.map(async (e) => ({
      ...e,
      label: e.toStatus === 'PAYMENT_REFUNDED' ? paymentRefunded : await statusLabel(e.toStatus, locale),
    })),
  );

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{heading}</h2>
      <ol className="flex flex-col gap-0">
        {rows.map((e, i) => (
          <li key={i} className="relative flex gap-3 ps-1">
            <div className="flex flex-col items-center">
              <span className={`mt-1 size-2.5 shrink-0 rounded-full ${i === rows.length - 1 ? 'bg-primary' : 'bg-border'}`} />
              {i < rows.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="pb-4">
              <div className="text-sm font-medium text-foreground">{e.label}</div>
              <div className="text-xs text-muted-foreground">
                {fmt(e.createdAt, locale)}
                {showActor && e.actorName ? ` · ${e.actorName}` : ''}
              </div>
              {e.note && <div className="mt-0.5 text-xs text-muted-foreground">{e.note}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
