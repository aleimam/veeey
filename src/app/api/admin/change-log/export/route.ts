import { exportChangeLog, entrySummary } from '@/lib/change-log-service';

/** CSV export of the change/audit log (owner ask: "record AND report all
 *  actions"). Respects the same filters as the viewer: type, id, q (action),
 *  from, to. Admin-gated inside exportChangeLog. */
const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;
  let entries;
  try {
    entries = await exportChangeLog({
      entityType: p.get('type') ?? undefined,
      entityId: p.get('id') ?? undefined,
      action: p.get('q') ?? undefined,
      from: p.get('from') ?? undefined,
      to: p.get('to') ?? undefined,
    });
  } catch {
    return new Response('forbidden', { status: 403 });
  }

  const header = ['When (UTC)', 'Actor', 'Actor type', 'Action', 'Entity type', 'Entity id', 'Details'];
  const lines = entries.map((e) =>
    [e.createdAt.toISOString(), e.actorLabel, e.actorType, e.action, e.entityType ?? '', e.entityId ?? '', entrySummary(e)].map(cell).join(','),
  );
  const csv = [header.map(cell).join(','), ...lines].join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="change-log-${stamp}.csv"`,
    },
  });
}
