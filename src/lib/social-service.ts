import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/** Footer social links (FR-SF). Admin-managed, ordered; rendered in the footer.
 *  Platforms are a fixed list (each has a bundled icon); "other" uses a generic
 *  link icon + the custom label. Gated by content.manage, audited. */
const PERM = 'content.manage';

export const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'other', label: 'Other' },
] as const;

const PLATFORM_VALUES = SOCIAL_PLATFORMS.map((p) => p.value);

/** Active links for the footer, ordered. Best-effort (DB hiccup → []). */
export async function activeSocialLinks() {
  try {
    return await prisma.socialLink.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  } catch {
    return [];
  }
}

export const listSocialLinks = () =>
  prisma.socialLink.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
export const getSocialLink = (id: string) => prisma.socialLink.findUnique({ where: { id } });

const schema = z.object({
  platform: z.enum(PLATFORM_VALUES as [string, ...string[]]),
  label: z.string().trim().optional().nullable(),
  url: z.string().trim().url(),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});
export type SocialLinkInput = z.input<typeof schema>;

export async function saveSocialLink(id: string | null, raw: SocialLinkInput) {
  const user = await requirePermission(PERM);
  const d = schema.parse(raw);
  const data = { platform: d.platform, label: d.label ?? null, url: d.url, sortOrder: d.sortOrder, active: d.active };
  const link = id
    ? await prisma.socialLink.update({ where: { id }, data })
    : await prisma.socialLink.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'social.update' : 'social.create', entityType: 'SocialLink', entityId: link.id });
  return link;
}

export async function deleteSocialLink(id: string) {
  const user = await requirePermission(PERM);
  const link = await prisma.socialLink.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'social.delete', entityType: 'SocialLink', entityId: id });
  return link;
}
