import { requirePermission } from '@/lib/auth-guards';
import { buildCsv } from '@/lib/csv-io';
import { notStockedProducts } from '@/lib/go-live-service';

/**
 * Stock-import CSV template, pre-filled with every not-yet-stocked product's SKU
 * + name (name is a reference column the importer ignores). Staff fill in qty +
 * expiry and upload it back on the Go-live page. UTF-8 BOM for Excel/Arabic.
 */
export async function GET() {
  try {
    await requirePermission('inventory.manage');
  } catch {
    return new Response('forbidden', { status: 403 });
  }
  const products = await notStockedProducts();
  // `sku` is what the importer matches on (any of Veeey SKU / EV SKU / EV id work).
  // `ev_id` + `ev_sku` are reference columns the importer ignores — use them to
  // VLOOKUP your existing Egypt Vitamins stock sheet and fill qty/expiry.
  const headers = ['sku', 'ev_id', 'ev_sku', 'name', 'qty', 'expiry', 'price', 'location', 'batch', 'sale'];
  const rows = products.map((p) => [p.sku, p.legacyWpId ?? '', p.legacySku ?? '', p.nameEn, '', '', '', '', '', '']);
  const csv = '﻿' + buildCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="veeey-stock-template.csv"',
    },
  });
}
