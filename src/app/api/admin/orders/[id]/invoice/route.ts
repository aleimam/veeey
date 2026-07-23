import { requirePermission } from '@/lib/auth-guards';
import { getOrder } from '@/lib/order-service';
import { generateInvoicePdf } from '@/lib/invoice';
import { loadLetterheadPng } from '@/lib/invoice-letterhead';
import { invoicePaymentLabel } from '@/lib/payment-method-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requirePermission('orders.read');
  } catch {
    return new Response('forbidden', { status: 403 });
  }
  const order = await getOrder(id);
  if (!order) return new Response('not found', { status: 404 });

  const [paymentLabel, letterheadPng] = await Promise.all([
    invoicePaymentLabel(order.systemPaymentMethod, order.paymentMethod, 'en'),
    loadLetterheadPng(),
  ]);
  try {
    const pdf = await generateInvoicePdf({ ...order, items: order.items.filter((i) => !i.lost), paymentLabel }, { letterheadPng }); // LOST lines excluded
    return new Response(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="invoice-${order.number}.pdf"`,
      },
    });
  } catch (e) {
    // A generation failure must be a clean 500, not a broken half-stream
    // (ERR_INVALID_RESPONSE) — that's how the pdfkit AFM bundling bug hid.
    const { logSystemError } = await import('@/lib/error-log');
    await logSystemError({ level: 'ERROR', message: `invoice PDF failed for ${order.number}: ${e instanceof Error ? e.message : 'error'}`, source: 'invoice', stack: e instanceof Error ? e.stack : undefined }).catch(() => {});
    return new Response('invoice generation failed — see Admin → Error log', { status: 500 });
  }
}
