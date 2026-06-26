import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-guards';
import { EXPORT_ENTITIES, EXPORT_PERMISSION, buildExportCsv, buildTemplateCsv, type ExportEntity } from '@/lib/admin-export';

/** Admin CSV export / template download (FR-ADM). Filters come from the query
 *  string (same as the list page); `?template=1` returns headers only. */
export async function GET(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!EXPORT_ENTITIES.includes(entity as ExportEntity)) return new NextResponse('Not found', { status: 404 });
  const e = entity as ExportEntity;
  await requirePermission(EXPORT_PERMISSION[e]);

  const u = new URL(req.url);
  const sp = Object.fromEntries(u.searchParams.entries());
  const ids = u.searchParams.getAll('ids'); // export-selected: repeated ?ids=… → collapse for the adapters
  if (ids.length) sp.ids = ids.join('~');
  const isTemplate = sp.template === '1';
  const csv = isTemplate ? await buildTemplateCsv(e) : await buildExportCsv(e, sp);
  const filename = isTemplate ? `${e}-template.csv` : `${e}-export.csv`;

  // Prepend a BOM so Excel opens UTF-8 (Arabic) correctly.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
