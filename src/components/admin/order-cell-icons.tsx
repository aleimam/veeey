import { Banknote, Landmark, CreditCard, Smartphone, Globe, Phone, MessageCircle, Share2, Camera, Repeat, Lock, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Small icon cells for the orders list (payment methods, channels, staff avatar).
 *  Each carries a native `title` so hovering shows the full name. */

const initials = (name?: string | null) =>
  (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export function StaffAvatar({ name, image }: { name?: string | null; image?: string | null }) {
  const label = name || '—';
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={label} title={label} className="size-7 rounded-full border border-border object-cover" />;
  }
  if (!name) return <span className="text-muted-foreground" title="—">—</span>;
  return (
    <span title={label} className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{initials(name)}</span>
  );
}

const PAYMENT_ICON: Record<string, LucideIcon> = {
  COD: Banknote,
  BANK_TRANSFER: Landmark,
  CARD_OPAY: CreditCard,
  CARD_KASHIER: CreditCard,
  POS_ON_DELIVERY: Smartphone,
};

export function PaymentIcon({ code, label }: { code: string | null | undefined; label: string }) {
  const Icon = (code && PAYMENT_ICON[code]) || HelpCircle;
  return (
    <span title={label} className="inline-flex size-7 items-center justify-center rounded-md bg-surface text-muted-foreground">
      <Icon size={16} />
    </span>
  );
}

const CHANNEL_ICON: Record<string, LucideIcon> = {
  DIRECT: Globe,
  WHATSAPP: MessageCircle,
  PHONE: Phone,
  PRIVATE: Lock,
  FACEBOOK: Share2,
  INSTAGRAM: Camera,
  FOLLOW_UP: Repeat,
};

export function ChannelIcon({ code, label }: { code: string | null | undefined; label: string }) {
  const Icon = (code && CHANNEL_ICON[code]) || HelpCircle;
  return (
    <span title={label} className="inline-flex size-7 items-center justify-center rounded-md bg-surface text-muted-foreground">
      <Icon size={16} />
    </span>
  );
}
