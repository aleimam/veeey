import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { GOVERNORATES } from '@/lib/governorates';
import { cityCode } from '@/lib/city-code';

/**
 * Delivery districts, grouped under a governorate (owner 2026-07-23).
 *
 * See the `City` model for why these are districts rather than administrative
 * cities. Reads are unauthenticated (the checkout needs them); every write is
 * RBAC-gated and audited like the rest of shipping configuration.
 */

export type CityOption = { code: string; nameEn: string; nameAr: string };
/** governorate (canonical EN) → its districts, in display order. */
export type CitiesByGovernorate = Record<string, CityOption[]>;

/**
 * The whole list, grouped — ~400 rows / ~25KB, so the checkout ships all of it
 * and filters in the browser. A round trip per governorate change would put a
 * spinner in the middle of typing an address for no benefit at this size.
 */
export async function citiesByGovernorate(): Promise<CitiesByGovernorate> {
  const rows = await prisma.city.findMany({
    where: { active: true },
    orderBy: [{ governorate: 'asc' }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
    select: { code: true, governorate: true, nameEn: true, nameAr: true },
  });
  const out: CitiesByGovernorate = {};
  for (const r of rows) (out[r.governorate] ??= []).push({ code: r.code, nameEn: r.nameEn, nameAr: r.nameAr });
  return out;
}

export const listCities = (governorate?: string) =>
  prisma.city.findMany({
    where: governorate ? { governorate } : undefined,
    orderBy: [{ governorate: 'asc' }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
  });

export const getCity = (id: string) => prisma.city.findUnique({ where: { id } });

const GOV_NAMES = GOVERNORATES.map((g) => g.en);

const citySchema = z.object({
  // Must be one of the 27 — a typo here creates a district nobody can ever
  // select, because the dropdown only shows districts matching the address's
  // governorate.
  governorate: z.string().refine((v) => GOV_NAMES.includes(v), 'unknown governorate'),
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
export type CityInput = z.input<typeof citySchema>;

export async function saveCity(id: string | null, raw: CityInput) {
  const user = await requirePermission('settings.manage');
  const data = citySchema.parse(raw);
  const code = cityCode(data.governorate, data.nameEn);

  // The code is derived from the name, so an edit that renames a district would
  // collide with an existing one. Report it instead of throwing a raw P2002 at
  // the admin.
  const clash = await prisma.city.findUnique({ where: { code } });
  if (clash && clash.id !== id) throw new Error('CITY_EXISTS');

  const row = id
    ? await prisma.city.update({ where: { id }, data: { ...data, code } })
    : await prisma.city.create({ data: { ...data, code } });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'city.update' : 'city.create', entityType: 'City', entityId: row.id, data: { code: row.code } });
  return row;
}

export async function deleteCity(id: string) {
  const user = await requirePermission('settings.manage');
  const row = await prisma.city.findUnique({ where: { id } });
  if (!row) return;
  // Addresses store the NAME, not a foreign key, so deleting a district cannot
  // orphan one — but it does remove a place customers may still live in. The
  // admin UI offers deactivate first; this stays for genuine mistakes.
  await prisma.city.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'city.delete', entityType: 'City', entityId: id, data: { code: row.code, governorate: row.governorate, nameEn: row.nameEn } });
}
