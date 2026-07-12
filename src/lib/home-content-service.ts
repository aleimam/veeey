import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/**
 * Editable homepage content (FR-SF / admin homepage management). Stored in the
 * Setting table under `home.*` keys, bilingual (`.en` / `.ar`). The locked
 * homepage layout renders these and falls back to the i18n defaults when unset.
 * Gated by content.manage, audited. Layout stays locked — content only.
 */
const PERM = 'content.manage';

// Editable fields (base key + admin label). The form renders EN + AR per field.
export const HOME_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: 'home.announcement', label: 'Announcement bar' },
  { key: 'home.heroTitle', label: 'Hero — title' },
  { key: 'home.heroSubtitle', label: 'Hero — subtitle', multiline: true },
  { key: 'home.card1.title', label: 'Card 1 — title' },
  { key: 'home.card1.desc', label: 'Card 1 — description', multiline: true },
  { key: 'home.card2.title', label: 'Card 2 — title' },
  { key: 'home.card2.desc', label: 'Card 2 — description', multiline: true },
  { key: 'home.card3.title', label: 'Card 3 — title' },
  { key: 'home.card3.desc', label: 'Card 3 — description', multiline: true },
];

export const FEATURED_KEY = 'home.featuredCollectionId';
export const ANNOUNCEMENT_ENABLED_KEY = 'home.announcementEnabled';

const KNOWN = new Set([...HOME_FIELDS.flatMap((f) => [`${f.key}.en`, `${f.key}.ar`]), FEATURED_KEY, ANNOUNCEMENT_ENABLED_KEY]);

/** Collection chosen to drive the homepage featured row (null = auto top-rated). */
export async function getFeaturedCollectionId(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: FEATURED_KEY } });
    return row?.value || null;
  } catch {
    return null;
  }
}

async function rawMap(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'home.' } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

export type HomeContent = {
  announcement?: string;
  announcementEnabled: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
  cards: { title?: string; desc?: string }[];
};

/** Resolved homepage content for a locale (undefined = use the i18n default). */
export async function getHomeContent(locale: string): Promise<HomeContent> {
  const map = await rawMap();
  const pick = (base: string) => map[`${base}.${locale}`]?.trim() || undefined;
  return {
    announcement: pick('home.announcement'),
    announcementEnabled: map['home.announcementEnabled'] !== 'false', // default shown
    heroTitle: pick('home.heroTitle'),
    heroSubtitle: pick('home.heroSubtitle'),
    cards: [1, 2, 3].map((n) => ({ title: pick(`home.card${n}.title`), desc: pick(`home.card${n}.desc`) })),
  };
}

/** Raw values keyed `home.*.{en,ar}` for the admin form. */
export const getHomeRaw = () => rawMap();

export async function saveHomeContent(values: Record<string, string>) {
  const user = await requirePermission(PERM);
  const entries = Object.entries(values).filter(([k]) => KNOWN.has(k));
  await prisma.$transaction(
    entries.map(([key, value]) =>
      value.trim()
        ? prisma.setting.upsert({ where: { key }, update: { value: value.trim() }, create: { key, value: value.trim() } })
        : prisma.setting.deleteMany({ where: { key } }), // blank → clear override (revert to default)
    ),
  );
  await audit({ actorType: 'USER', actorId: user.id, action: 'home.content.update', entityType: 'Setting', entityId: 'home.*' });
}
