import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/** Editable homepage testimonials + trust badges (FR-SF / homepage mgmt).
 *  content.manage, audited. Storefront reads active rows, ordered; falls back
 *  to the i18n defaults when empty. */
const PERM = 'content.manage';

// ---- Testimonials ----------------------------------------------------------
export const activeTestimonials = async () => {
  try { return await prisma.homeTestimonial.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }); }
  catch { return []; }
};
export const listTestimonials = () => prisma.homeTestimonial.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
export const getTestimonial = (id: string) => prisma.homeTestimonial.findUnique({ where: { id } });

const testimonialSchema = z.object({
  quoteEn: z.string().trim().min(1),
  quoteAr: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1),
  location: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});
export type TestimonialInput = z.input<typeof testimonialSchema>;

export async function saveTestimonial(id: string | null, raw: TestimonialInput) {
  const user = await requirePermission(PERM);
  const d = testimonialSchema.parse(raw);
  const data = { quoteEn: d.quoteEn, quoteAr: d.quoteAr ?? null, name: d.name, location: d.location ?? null, sortOrder: d.sortOrder, active: d.active };
  const row = id ? await prisma.homeTestimonial.update({ where: { id }, data }) : await prisma.homeTestimonial.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'testimonial.update' : 'testimonial.create', entityType: 'HomeTestimonial', entityId: row.id });
  return row;
}
export async function deleteTestimonial(id: string) {
  const user = await requirePermission(PERM);
  await prisma.homeTestimonial.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'testimonial.delete', entityType: 'HomeTestimonial', entityId: id });
}

// ---- Trust badges ----------------------------------------------------------
export const activeTrustBadges = async () => {
  try { return await prisma.homeTrustBadge.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }); }
  catch { return []; }
};
export const listTrustBadges = () => prisma.homeTrustBadge.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
export const getTrustBadge = (id: string) => prisma.homeTrustBadge.findUnique({ where: { id } });

const badgeSchema = z.object({
  labelEn: z.string().trim().min(1),
  labelAr: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});
export type TrustBadgeInput = z.input<typeof badgeSchema>;

export async function saveTrustBadge(id: string | null, raw: TrustBadgeInput) {
  const user = await requirePermission(PERM);
  const d = badgeSchema.parse(raw);
  const data = { labelEn: d.labelEn, labelAr: d.labelAr ?? null, sortOrder: d.sortOrder, active: d.active };
  const row = id ? await prisma.homeTrustBadge.update({ where: { id }, data }) : await prisma.homeTrustBadge.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'trustbadge.update' : 'trustbadge.create', entityType: 'HomeTrustBadge', entityId: row.id });
  return row;
}
export async function deleteTrustBadge(id: string) {
  const user = await requirePermission(PERM);
  await prisma.homeTrustBadge.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'trustbadge.delete', entityType: 'HomeTrustBadge', entityId: id });
}
