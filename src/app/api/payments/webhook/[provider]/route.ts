import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

/**
 * Payment gateway webhook (FR-PAY-03). Confirms payment and flips the order's
 * payment state. Real signature verification is added per provider when keys are
 * configured; for now it accepts a `{ orderNumber, status }` payload.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  try {
    const body = (await req.json()) as { orderNumber?: string; reference?: string; status?: string };
    const number = body.orderNumber ?? body.reference;
    if (number) {
      const state = body.status === 'failed' ? 'FAILED' : 'PAID';
      await prisma.order.updateMany({ where: { number }, data: { paymentState: state } });
      await audit({ actorType: 'SYSTEM', action: 'payment.webhook', entityType: 'Order', data: { provider, number, state } });
    }
  } catch {
    // ignore malformed payloads
  }
  return NextResponse.json({ received: true, provider });
}
