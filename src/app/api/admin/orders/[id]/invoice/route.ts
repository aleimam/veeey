import { requirePermission } from '@/lib/auth-guards';
import { getOrder } from '@/lib/order-service';
import { generateInvoicePdf } from '@/lib/invoice';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requirePermission('orders.read');
  } catch {
    return new Response('forbidden', { status: 403 });
  }
  const order = await getOrder(id);
  if (!order) return new Response('not found', { status: 404 });

  const pdf = await generateInvoicePdf(order);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="invoice-${order.number}.pdf"`,
    },
  });
}
