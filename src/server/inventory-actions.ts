'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { piastresToEgp } from '@/lib/format';
import { saveLot, setLotPrice, setLotStatus } from '@/lib/inventory-service';
import { mockShipmentReceived, publishIntakeLot } from '@/lib/intake-service';
import { saveLocation } from '@/lib/location-service';
import { createStocktake, recordCount, closeStocktake } from '@/lib/stocktake-service';
import type { Prisma } from '@/generated/prisma/client';

export type AdminFormState = { error?: string };

/** Product hit for the inventory single-select picker (V4 C8) — includes SKU +
 *  base price so the lot form's price/discount calculator works per selection. */
export type InventoryPickerProduct = { id: string; name: string; sku: string; brand: string | null; thumb: string | null; basePriceEgp: number };

export async function searchInventoryProductsAction(q: string): Promise<InventoryPickerProduct[]> {
  await requirePermission('inventory.manage');
  const term = q.trim();
  if (term.length < 2) return [];
  const or: Prisma.ProductWhereInput[] = [
    { nameEn: { contains: term, mode: 'insensitive' } },
    { nameAr: { contains: term } },
    { sku: { contains: term, mode: 'insensitive' } },
    { brand: { nameEn: { contains: term, mode: 'insensitive' } } },
  ];
  const rows = await prisma.product.findMany({
    where: { OR: or },
    include: { brand: { select: { nameEn: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    orderBy: { nameEn: 'asc' },
    take: 15,
  });
  return rows.map((p) => ({
    id: p.id, name: p.nameEn, sku: p.sku, brand: p.brand?.nameEn ?? null,
    thumb: p.images[0]?.url ?? null, basePriceEgp: piastresToEgp(p.basePricePiastres),
  }));
}

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v == null ? undefined : Number(v);
};
const bool = (fd: FormData, k: string) => fd.get(k) != null;

function fail(e: unknown): AdminFormState {
  if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
  if (e instanceof Error && e.message === 'INSUFFICIENT_STOCK') return { error: 'insufficient' };
  console.error('inventory action failed', e);
  return { error: 'invalid' };
}
function done(locale: string, path: string): never {
  revalidatePath(`/${locale}/admin/${path}`);
  redirect(`/${locale}/admin/${path}`);
}

// ---- Lots ------------------------------------------------------------------
export async function saveLotAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveLot(str(fd, 'id') ?? null, {
      productId: str(fd, 'productId') ?? '',
      locationId: str(fd, 'locationId') ?? '',
      expiryDate: str(fd, 'expiryDate') ?? '',
      noExpiry: bool(fd, 'noExpiry'),
      qtyOnHand: str(fd, 'qtyOnHand') ?? '0',
      costEgp: str(fd, 'costEgp'),
      priceOverrideEgp: str(fd, 'priceOverrideEgp'),
      condition: (str(fd, 'condition') ?? 'NEW') as 'NEW' | 'OPEN_BOX' | 'DAMAGED' | 'BROKEN',
      saleFlag: bool(fd, 'saleFlag'),
      status: (str(fd, 'status') ?? 'LIVE') as 'LIVE' | 'QUARANTINE' | 'EXPIRED' | 'WRITTEN_OFF',
    });
  } catch (e) {
    return fail(e);
  }
  done(locale, 'inventory/lots');
}

/** Create/update a lot from the product edit page; returns there (not /lots). */
export async function saveProductLotAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId') ?? '';
  if (!productId) done(locale, 'products');
  let ok = true;
  try {
    await saveLot(str(fd, 'id') ?? null, {
      productId,
      locationId: str(fd, 'locationId') ?? '',
      expiryDate: str(fd, 'expiryDate') ?? '',
      noExpiry: bool(fd, 'noExpiry'),
      qtyOnHand: str(fd, 'qtyOnHand') ?? '0',
      costEgp: str(fd, 'costEgp'),
      priceOverrideEgp: str(fd, 'priceOverrideEgp'),
      condition: (str(fd, 'condition') ?? 'NEW') as 'NEW' | 'OPEN_BOX' | 'DAMAGED' | 'BROKEN',
      saleFlag: bool(fd, 'saleFlag'),
      status: (str(fd, 'status') ?? 'LIVE') as 'LIVE' | 'QUARANTINE' | 'EXPIRED' | 'WRITTEN_OFF',
    });
  } catch (e) {
    ok = false;
    fail(e);
  }
  revalidatePath(`/${locale}/admin/products/edit/${productId}`);
  redirect(`/${locale}/admin/products/edit/${productId}?${ok ? 'lot=saved' : 'lot=error'}#stock`);
}

export async function setLotPriceAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'lotId');
  if (id) {
    try {
      await setLotPrice(id, num(fd, 'priceOverrideEgp') ?? null, bool(fd, 'saleFlag'));
    } catch (e) {
      fail(e);
    }
  }
  done(locale, 'inventory/lots');
}

export async function setLotStatusAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'lotId');
  const status = str(fd, 'status') as 'LIVE' | 'QUARANTINE' | 'EXPIRED' | 'WRITTEN_OFF' | undefined;
  if (id && status) {
    try { await setLotStatus(id, status); } catch (e) { fail(e); }
  }
  done(locale, 'inventory/lots');
}

// ---- Intake ----------------------------------------------------------------
export async function simulateShipmentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const sku = str(fd, 'sku');
  const qty = num(fd, 'qty') ?? 0;
  if (sku && qty > 0) {
    try { await mockShipmentReceived([{ sku, qty, batchId: `MOCK-${Date.now()}` }]); } catch (e) { fail(e); }
  }
  done(locale, 'inventory/intake');
}

export async function publishIntakeAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  const id = str(fd, 'lotId');
  try {
    if (id) {
      await publishIntakeLot(id, {
        expiryDate: str(fd, 'expiryDate') ?? '',
        priceOverrideEgp: num(fd, 'priceOverrideEgp') ?? null,
        saleFlag: bool(fd, 'saleFlag'),
      });
    }
  } catch (e) {
    return fail(e);
  }
  done(locale, 'inventory/intake');
}

// ---- Locations -------------------------------------------------------------
export async function saveLocationAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveLocation(str(fd, 'id') ?? null, {
      name: str(fd, 'name') ?? '',
      type: str(fd, 'type') ?? 'warehouse',
      isUltraFastZone: bool(fd, 'isUltraFastZone'),
    });
  } catch (e) {
    return fail(e);
  }
  done(locale, 'inventory/locations');
}

// ---- Stocktake -------------------------------------------------------------
export async function createStocktakeAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const name = str(fd, 'name');
  const locationId = str(fd, 'locationId');
  if (!name || !locationId) done(locale, 'stocktake');
  let id: string | undefined;
  try {
    const s = await createStocktake(name!, locationId!);
    id = s.id;
  } catch (e) {
    fail(e);
  }
  revalidatePath(`/${locale}/admin/stocktake`);
  redirect(id ? `/${locale}/admin/stocktake/${id}` : `/${locale}/admin/stocktake`);
}

export async function recordCountAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const sessionId = str(fd, 'sessionId');
  const lotId = str(fd, 'lotId');
  const counted = num(fd, 'countedQty');
  if (sessionId && lotId && counted != null) {
    try { await recordCount(sessionId, lotId, counted, str(fd, 'reason')); } catch (e) { fail(e); }
  }
  revalidatePath(`/${locale}/admin/stocktake/${sessionId}`);
  redirect(`/${locale}/admin/stocktake/${sessionId}`);
}

export async function closeStocktakeAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const sessionId = str(fd, 'sessionId');
  if (sessionId) {
    try { await closeStocktake(sessionId); } catch (e) { fail(e); }
  }
  done(locale, 'stocktake');
}
