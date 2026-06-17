import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-guards';
import { getSmsaLabelPdf } from '@/lib/carriers/smsa';

/** Serve an SMSA shipping label (getPDF → PDF bytes) for printing. */
export async function GET(req: Request) {
  await requirePermission('orders.read');
  const awb = new URL(req.url).searchParams.get('awb') ?? '';
  if (!awb) return new NextResponse('Missing awb', { status: 400 });
  const pdf = await getSmsaLabelPdf(awb);
  if (!pdf) return new NextResponse('Label unavailable', { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="smsa-${awb}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
