import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/** Locations (FR-INV-07) — multi-location ready; FEFO & stocktake operate per location. */

export const listLocations = () => prisma.location.findMany({ orderBy: { name: 'asc' } });
export const getLocation = (id: string) => prisma.location.findUnique({ where: { id } });

const locationSchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().default('warehouse'),
  isUltraFastZone: z.boolean().default(false),
});
export type LocationInput = z.input<typeof locationSchema>;

export async function saveLocation(id: string | null, raw: LocationInput) {
  const user = await requirePermission('inventory.manage');
  const d = locationSchema.parse(raw);
  const location = id
    ? await prisma.location.update({ where: { id }, data: d })
    : await prisma.location.create({ data: d });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'location.update' : 'location.create', entityType: 'Location', entityId: location.id });
  return location;
}
