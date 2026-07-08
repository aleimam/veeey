'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { parseCsvObjects } from '@/lib/csv-io';
import { importStock, quickAddStock, publishReady, type StockImportReport } from '@/lib/go-live-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const PATH = (l: string) => `/${l}/admin/go-live`;

export type StockImportState = { report?: StockImportReport; error?: 'no_file' | 'too_large' | 'empty' | 'failed' };

export async function importStockAction(_prev: StockImportState, fd: FormData): Promise<StockImportState> {
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'no_file' };
  if (file.size > 5_000_000) return { error: 'too_large' };
  const rows = parseCsvObjects(await file.text());
  if (rows.length === 0) return { error: 'empty' };
  try {
    const report = await importStock(rows);
    revalidatePath(PATH(localeOf(fd)));
    return { report };
  } catch (e) {
    console.error('stock import failed', e);
    return { error: 'failed' };
  }
}

export async function quickAddStockAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const andPublish = fd.get('andPublish') != null; // combined "Add stock + Publish" flow
  try {
    await quickAddStock({
      productId,
      qty: Number(str(fd, 'qty')),
      expiry: str(fd, 'expiry') || null,
      priceEgp: str(fd, 'priceEgp') ? Number(str(fd, 'priceEgp')) : null,
      saleFlag: fd.get('sale') != null,
    });
  } catch (e) { console.error('quick add stock failed', e); revalidatePath(PATH(locale)); redirect(`${PATH(locale)}?error=1`); }
  let published = 0;
  if (andPublish) {
    // publishReady only flips ready products — an unpriced/imageless product is
    // reported back as "not ready" instead of silently published.
    try { published = (await publishReady([productId])).published; } catch (e) { console.error('add+publish failed', e); }
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?added=1${andPublish ? (published ? `&published=${published}` : '&notready=1') : ''}`);
}

export async function publishReadyAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const ids = fd.getAll('ids').map((v) => String(v)).filter(Boolean);
  let res = { published: 0, skipped: 0 };
  try { res = await publishReady(ids.length ? ids : undefined); } catch (e) { console.error('publish ready failed', e); revalidatePath(PATH(locale)); redirect(`${PATH(locale)}?error=1`); }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?published=${res.published}`);
}
