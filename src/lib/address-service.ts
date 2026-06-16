import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Customer address book (FR-ACC-03). A customer can keep many addresses and pick
 * one at checkout; placeOrder still snapshots the chosen address onto the order.
 * Street/building/phone optional; ZIP not collected (Egypt).
 */
export const addressSchema = z.object({
  governorate: z.string().trim().min(1),
  city: z.string().trim().min(1),
  area: z.string().trim().min(1),
  street: z.string().trim().optional(),
  building: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  isDefaultShipping: z.boolean().optional(),
});
export type AddressInput = z.input<typeof addressSchema>;

export const listAddresses = (customerId: string) =>
  prisma.address.findMany({ where: { customerId }, orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }] });

function data(d: z.infer<typeof addressSchema>, fallbackDefault = false) {
  return {
    governorate: d.governorate,
    city: d.city,
    area: d.area,
    street: d.street || null,
    building: d.building || null,
    phone: d.phone || null,
    isDefaultShipping: d.isDefaultShipping ?? fallbackDefault,
  };
}

export async function createAddress(customerId: string, raw: AddressInput) {
  const d = addressSchema.parse(raw);
  if (d.isDefaultShipping) await prisma.address.updateMany({ where: { customerId }, data: { isDefaultShipping: false } });
  return prisma.address.create({ data: { customerId, ...data(d) } });
}

export async function updateAddress(customerId: string, id: string, raw: AddressInput) {
  const d = addressSchema.parse(raw);
  const owned = await prisma.address.findFirst({ where: { id, customerId } });
  if (!owned) throw new Error('NOT_FOUND');
  if (d.isDefaultShipping) await prisma.address.updateMany({ where: { customerId }, data: { isDefaultShipping: false } });
  return prisma.address.update({ where: { id }, data: data(d, owned.isDefaultShipping) });
}

export async function deleteAddress(customerId: string, id: string) {
  // Detach from any orders (the order keeps its own JSON snapshot) before delete.
  await prisma.order.updateMany({ where: { shippingAddressId: id, customerId }, data: { shippingAddressId: null } });
  await prisma.address.deleteMany({ where: { id, customerId } });
}

export async function setDefaultAddress(customerId: string, id: string) {
  await prisma.address.updateMany({ where: { customerId }, data: { isDefaultShipping: false } });
  await prisma.address.updateMany({ where: { id, customerId }, data: { isDefaultShipping: true } });
}
