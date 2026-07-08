import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { toWebp } from '@/lib/images';
import { storeImage } from '@/lib/storage';

/**
 * Media localization (hardening): ~12.8k catalog images still point at the OLD
 * site's CDN (egyptvitamin.b-cdn.net) — if that account lapses the storefront
 * goes imageless, and some URLs already 404. This worker job downloads every
 * remote catalog image, converts to WebP into public/uploads (same storage as
 * manual uploads) and rewrites the DB URLs. Dead URLs are pruned (ProductImage
 * row deleted / brand-category field nulled) so products fall back to the
 * placeholder and surface in the "missing image" filters instead of rendering
 * broken. Idempotent + resumable: filenames are sha1(url) so a re-run skips
 * everything already localized.
 */

const STATUS_KEY = 'media.localizeJob';
export type MediaLocalizeStatus = { state: 'running' | 'done' | 'error'; done: number; total: number; failed: number; deleted: number; at: string };

async function setStatus(v: MediaLocalizeStatus) {
  const value = JSON.stringify(v);
  await prisma.setting.upsert({ where: { key: STATUS_KEY }, update: { value }, create: { key: STATUS_KEY, value } });
}

export async function getMediaLocalizeStatus(): Promise<MediaLocalizeStatus | null> {
  const row = await prisma.setting.findUnique({ where: { key: STATUS_KEY } });
  if (!row) return null;
  try { return JSON.parse(row.value) as MediaLocalizeStatus; } catch { return null; }
}

/** How many media rows still point at a remote host (drives the admin card). */
export async function countRemoteMedia(): Promise<number> {
  const [images, logos, banners, cats] = await Promise.all([
    prisma.productImage.count({ where: { url: { startsWith: 'http' } } }),
    prisma.brand.count({ where: { logoUrl: { startsWith: 'http' } } }),
    prisma.brand.count({ where: { bannerUrl: { startsWith: 'http' } } }),
    prisma.category.count({ where: { imageUrl: { startsWith: 'http' } } }),
  ]);
  return images + logos + banners + cats;
}

const isRemote = (u: string | null | undefined): u is string => !!u && /^https?:\/\//i.test(u);
const localName = (url: string) => `${createHash('sha1').update(url).digest('hex')}.webp`;

async function alreadyStored(name: string): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), 'public', 'uploads', name));
    return true;
  } catch {
    return false;
  }
}

/** Download → WebP → /uploads. Returns the local URL, or null when the source
 *  is dead/unusable (after 2 attempts). */
async function localizeOne(url: string): Promise<string | null> {
  const name = localName(url);
  if (await alreadyStored(name)) return `/uploads/${name}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'veeey-media-localizer' } });
      if (res.status === 404 || res.status === 410) return null; // permanently gone
      if (!res.ok) throw new Error(`http ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return null;
      const webp = await toWebp(buf);
      const stored = await storeImage(webp, name);
      return stored.url;
    } catch {
      if (attempt === 2) return null;
    }
  }
  return null;
}

export async function runMediaLocalization(): Promise<MediaLocalizeStatus> {
  // Distinct remote URLs across catalog media (many products share files).
  const [images, brands, categories] = await Promise.all([
    prisma.productImage.findMany({ where: { url: { startsWith: 'http' } }, select: { url: true }, distinct: ['url'] }),
    prisma.brand.findMany({ where: { OR: [{ logoUrl: { startsWith: 'http' } }, { bannerUrl: { startsWith: 'http' } }] }, select: { logoUrl: true, bannerUrl: true } }),
    prisma.category.findMany({ where: { imageUrl: { startsWith: 'http' } }, select: { imageUrl: true } }),
  ]);
  const urls = [...new Set([
    ...images.map((i) => i.url),
    ...brands.flatMap((b) => [b.logoUrl, b.bannerUrl].filter(isRemote)),
    ...categories.map((c) => c.imageUrl).filter(isRemote),
  ])];

  const now = () => new Date().toISOString();
  const status: MediaLocalizeStatus = { state: 'running', done: 0, total: urls.length, failed: 0, deleted: 0, at: now() };
  await setStatus(status);

  const CONCURRENCY = 6;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async (url) => ({ url, local: await localizeOne(url) })));
    for (const { url, local } of results) {
      if (local) {
        await prisma.productImage.updateMany({ where: { url }, data: { url: local } });
        await prisma.brand.updateMany({ where: { logoUrl: url }, data: { logoUrl: local } });
        await prisma.brand.updateMany({ where: { bannerUrl: url }, data: { bannerUrl: local } });
        await prisma.category.updateMany({ where: { imageUrl: url }, data: { imageUrl: local } });
        status.done++;
      } else {
        // Dead source: prune so products show the placeholder + hit the
        // "missing image" filters instead of rendering a broken image.
        const gone = await prisma.productImage.deleteMany({ where: { url } });
        await prisma.brand.updateMany({ where: { logoUrl: url }, data: { logoUrl: null } });
        await prisma.brand.updateMany({ where: { bannerUrl: url }, data: { bannerUrl: null } });
        await prisma.category.updateMany({ where: { imageUrl: url }, data: { imageUrl: null } });
        status.failed++;
        status.deleted += gone.count;
      }
    }
    status.at = now();
    if (i % (CONCURRENCY * 10) === 0 || i + CONCURRENCY >= urls.length) await setStatus(status);
  }

  status.state = 'done';
  status.at = now();
  await setStatus(status);
  await audit({
    actorType: 'SYSTEM', action: 'media.localize.run', entityType: 'ProductImage',
    entityId: `${status.done}/${status.total} localized`,
    data: { done: status.done, failed: status.failed, deletedRows: status.deleted },
  });
  return status;
}
