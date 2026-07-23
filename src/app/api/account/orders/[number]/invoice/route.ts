import { getCurrentUser } from '@/lib/auth-guards';
import { getOrderByNumber } from '@/lib/checkout-service';
import { getOrder } from '@/lib/order-service';
import { generateInvoicePdf } from '@/lib/invoice';
import { loadLetterheadPng } from '@/lib/invoice-letterhead';
import { invoicePaymentLabel } from '@/lib/payment-method-service';

/**
 * Customer-facing invoice download (FR-ORD-08). Ownership-checked: a signed-in
 * customer may only fetch their OWN order's invoice — order numbers are semi-
 * predictable, so we 404 (not 403) when the order isn't theirs, exactly like the
 * account order page. Reuses the same invoice PDF the admin prints.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const head = await getOrderByNumber(decodeURIComponent(number));
  if (!head || !user.customerId || head.customerId !== user.customerId) return new Response('not found', { status: 404 });
  // An order still awaiting payment isn't really placed — no invoice yet.
  if (head.status === 'AWAITING_PAYMENT') return new Response('not available', { status: 409 });

  const order = await getOrder(head.id);
  if (!order) return new Response('not found', { status: 404 });

  const [paymentLabel, letterheadPng] = await Promise.all([
    invoicePaymentLabel(order.systemPaymentMethod, order.paymentMethod, 'en'),
    loadLetterheadPng(),
  ]);
  try {
    const pdf = await generateInvoicePdf({ ...order, items: order.items.filter((i) => !i.lost), paymentLabel }, { letterheadPng });
    return new Response(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="invoice-${order.number}.pdf"`,
      },
    });
  } catch (e) {
    const { logSystemError } = await import('@/lib/error-log');
    await logSystemError({ level: 'ERROR', message: `customer invoice PDF failed for ${order.number}: ${e instanceof Error ? e.message : 'error'}`, source: 'invoice', stack: e instanceof Error ? e.stack : undefined }).catch(() => {});
    return new Response('invoice generation failed', { status: 500 });
  }
}
