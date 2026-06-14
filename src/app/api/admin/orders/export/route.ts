import { exportOrdersCsv } from '@/lib/export-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const csv = await exportOrdersCsv({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    });
    return new Response(csv, {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="veeey-orders.csv"' },
    });
  } catch {
    return new Response('forbidden', { status: 403 });
  }
}
