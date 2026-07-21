'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CircleDot, Truck, MessageSquare, UserRound, FileText, X, ArrowRight,
  Clock, Pencil, PauseCircle, BadgeCheck, PackageCheck, XCircle, RotateCcw, Undo2, type LucideIcon,
} from 'lucide-react';
import { transitionOrderAction, setTrackingAction, clearTrackingAction, setChannelAction, assignPharmacistAction } from '@/server/order-actions';

type Opt = { value: string; label: string };
type StatusCfg = { code: string; label: string; allowedNext: string[] };
/** One-click status advance surfaced directly in the row (config `fastAction`). */
type FastAction = { code: string; label: string; icon: string };

/** Resolve a status config's Lucide icon name → component (fallback: arrow). */
const STATUS_ICONS: Record<string, LucideIcon> = {
  'clock': Clock, 'pencil': Pencil, 'pause-circle': PauseCircle, 'badge-check': BadgeCheck,
  'truck': Truck, 'package-check': PackageCheck, 'x-circle': XCircle, 'rotate-ccw': RotateCcw, 'undo-2': Undo2,
};

const COURIERS = ['ARAMEX', 'SMSA', 'OWN'];
const field = 'mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm';
const saveBtn = 'mt-2 w-full rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground';

/** Icon trigger + portaled popover panel (escapes table overflow clipping). */
function Pop({ icon, title, label, children }: { icon: ReactNode; title: string; label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const W = 248;

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8)) });
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} title={label} aria-label={label} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground">
        {icon}
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: W }} className="z-50 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">{title}</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
          </div>
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function OrderQuickActions({
  locale, order, statuses, fastNext, pharmacists, channels, invoiceHref,
  labels,
}: {
  locale: string;
  order: { id: string; status: string; trackingNumber: string | null; courier: string | null; source: string | null; pharmacistId: string | null };
  statuses: StatusCfg[];
  fastNext: FastAction[];
  pharmacists: Opt[];
  channels: Opt[];
  invoiceHref: string;
  labels: {
    status: string; tracking: string; channel: string; pharmacist: string; invoice: string;
    save: string; courier: string; trackingNo: string; deleteTracking: string; unassigned: string; final: string;
  };
}) {
  const cfg = statuses.find((s) => s.code === order.status);
  const next = cfg?.allowedNext ?? [];
  const labelOf = (code: string) => statuses.find((s) => s.code === code)?.label ?? code;
  const hidden = <input type="hidden" name="locale" value={locale} />;
  const idField = <input type="hidden" name="id" value={order.id} />;

  return (
    <div className="flex items-center justify-end gap-0.5">
      {/* Fast actions — one-click advances the owner flagged in the Status Matrix,
          pre-filtered server-side to what this user may do from the current status. */}
      {fastNext.map((f) => {
        const Icon = STATUS_ICONS[f.icon] ?? ArrowRight;
        const title = `${labels.status}: ${f.label}`;
        return (
          <form key={f.code} action={transitionOrderAction}>{hidden}{idField}<input type="hidden" name="status" value={f.code} />
            <button title={title} aria-label={title} className="rounded-md p-1.5 text-primary hover:bg-primary/10">
              <Icon className="size-4" />
            </button>
          </form>
        );
      })}

      {/* Status */}
      <Pop icon={<CircleDot className="size-4" />} title={labels.status} label={labels.status}>
        {() => (
          <div className="flex flex-col gap-1.5">
            {next.length === 0 && <span className="text-xs text-muted-foreground">{labels.final}</span>}
            {next.map((c) => (
              <form key={c} action={transitionOrderAction}>{hidden}{idField}<input type="hidden" name="status" value={c} />
                <button className="w-full rounded-md border border-border px-2 py-1 text-start text-xs hover:bg-surface">{labelOf(c)}</button>
              </form>
            ))}
          </div>
        )}
      </Pop>

      {/* Tracking */}
      <Pop icon={<Truck className="size-4" />} title={labels.tracking} label={labels.tracking}>
        {() => (
          <div>
            <form action={setTrackingAction}>{hidden}{idField}
              <label className="text-xs text-muted-foreground">{labels.courier}
                <select name="courier" defaultValue={order.courier ?? ''} className={field}>
                  <option value="">—</option>
                  {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="mt-2 block text-xs text-muted-foreground">{labels.trackingNo}
                <input name="trackingNumber" defaultValue={order.trackingNumber ?? ''} required className={field} />
              </label>
              <button className={saveBtn}>{labels.save}</button>
            </form>
            {order.trackingNumber && (
              <form action={clearTrackingAction} className="mt-1.5">{hidden}{idField}
                <button className="w-full rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-surface">{labels.deleteTracking}</button>
              </form>
            )}
          </div>
        )}
      </Pop>

      {/* Channel */}
      <Pop icon={<MessageSquare className="size-4" />} title={labels.channel} label={labels.channel}>
        {() => (
          <form action={setChannelAction}>{hidden}{idField}
            <select name="channel" defaultValue={order.source ?? ''} className={field}>
              <option value="">—</option>
              {channels.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button className={saveBtn}>{labels.save}</button>
          </form>
        )}
      </Pop>

      {/* Pharmacist */}
      <Pop icon={<UserRound className="size-4" />} title={labels.pharmacist} label={labels.pharmacist}>
        {() => (
          <form action={assignPharmacistAction}>{hidden}{idField}
            <select name="pharmacistId" defaultValue={order.pharmacistId ?? ''} className={field}>
              <option value="">{labels.unassigned}</option>
              {pharmacists.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <button className={saveBtn}>{labels.save}</button>
          </form>
        )}
      </Pop>

      {/* Invoice */}
      <a href={invoiceHref} target="_blank" rel="noreferrer" title={labels.invoice} aria-label={labels.invoice} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground">
        <FileText className="size-4" />
      </a>
    </div>
  );
}
