// NOTE: deliberately NO `import 'server-only'` — see gsc-service.ts. The
// worker imports this module for the batch watermark job, and that package
// only resolves through Next's bundler, never in the standalone tsx worker.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { getBranding } from '@/lib/branding-service';
import { parseWatermark, computeOffset, type WatermarkSettings } from '@/lib/watermark';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Reversible product-photo watermarking. Originals are never overwritten: a
 * stamped image is written as `<name>__wm.webp` and the ProductImage keeps the
 * source in `originalUrl`. Re-stamping always composites from the original;
 * "remove" restores it. Settings live in Settings keys `watermark.*`.
 */
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const WM_SUFFIX = '__wm.webp';

const urlToAbs = (url: string) => (url.startsWith('/uploads/') ? path.join(UPLOAD_DIR, url.slice('/uploads/'.length)) : path.join(PUBLIC_DIR, url.replace(/^\//, '')));
const stampedUrlFor = (originalUrl: string) => originalUrl.replace(/\.[a-z0-9]+$/i, '') + WM_SUFFIX.replace('.webp', '') + '.webp';
const isStamped = (url: string) => url.endsWith(WM_SUFFIX);
const deriveOriginal = (url: string) => (isStamped(url) ? url.slice(0, -WM_SUFFIX.length) : url); // base without ext

// ---- settings ---------------------------------------------------------------
export async function getWatermarkSettings(): Promise<WatermarkSettings> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'watermark.' } } });
    return parseWatermark(Object.fromEntries(rows.map((r) => [r.key.slice('watermark.'.length), r.value])));
  } catch {
    return parseWatermark({});
  }
}

export async function saveWatermarkSettings(raw: Record<string, string>): Promise<void> {
  const user = await requirePermission('catalog.write');
  const w = parseWatermark(raw);
  const entries: Record<string, string> = {
    logo: w.logo, position: w.position, sizePct: String(w.sizePct), opacity: String(w.opacity), marginPct: String(w.marginPct), autoStamp: String(w.autoStamp),
  };
  await prisma.$transaction(Object.entries(entries).map(([k, value]) =>
    prisma.setting.upsert({ where: { key: `watermark.${k}` }, update: { value }, create: { key: `watermark.${k}`, value } })));
  await audit({ actorType: 'USER', actorId: user.id, action: 'watermark.settings', entityType: 'Setting', entityId: 'watermark.*' });
}

async function readAsset(url: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//i.test(url)) return Buffer.from(await (await fetch(url)).arrayBuffer());
    return await readFile(urlToAbs(url));
  } catch {
    return null;
  }
}

/** The branding logo the watermark should use (with fallbacks to any set logo). */
async function watermarkLogoUrl(settings: WatermarkSettings): Promise<string | null> {
  const b = await getBranding();
  const byChoice = settings.logo === 'horizontal' ? b.logoUrl : settings.logo === 'transparent' ? b.logoLightUrl : b.logoIconUrl;
  return byChoice || b.logoIconUrl || b.logoUrl || b.logoLightUrl || '/icon.svg';
}

// ---- compositing ------------------------------------------------------------
/** Composite the logo onto a base image buffer per settings → WebP buffer. */
export async function stampBuffer(baseBuf: Buffer, logoBuf: Buffer, s: WatermarkSettings): Promise<Buffer> {
  const base = sharp(baseBuf).rotate();
  const meta = await base.metadata();
  const bw = meta.width ?? 800;
  const bh = meta.height ?? 800;
  const markW = Math.max(16, Math.round((bw * s.sizePct) / 100));
  const margin = Math.round((bw * s.marginPct) / 100);

  let logo = await sharp(logoBuf).resize({ width: markW }).ensureAlpha().png().toBuffer();
  const lm = await sharp(logo).metadata();
  const markH = lm.height ?? markW;
  // Uniform opacity: multiply the logo's alpha by opacity/255 via a dest-in tile.
  if (s.opacity < 100) {
    logo = await sharp(logo)
      .composite([{ input: Buffer.from([255, 255, 255, Math.round((s.opacity / 100) * 255)]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
      .png().toBuffer();
  }
  const { left, top } = computeOffset({ w: bw, h: bh }, { w: markW, h: markH }, s.position, margin);
  return sharp(baseBuf).rotate().composite([{ input: logo, left, top }]).webp({ quality: 85 }).toBuffer();
}

/** Stamp one ProductImage row (idempotent, always composites from the original). */
async function stampRow(row: { id: string; url: string; originalUrl: string | null }, s: WatermarkSettings, logoBuf: Buffer): Promise<boolean> {
  const originalUrl = row.originalUrl ?? (isStamped(row.url) ? row.url.slice(0, -WM_SUFFIX.length) + '.webp' : row.url);
  const baseBuf = await readAsset(originalUrl);
  if (!baseBuf) return false;
  const outUrl = stampedUrlFor(originalUrl);
  const stamped = await stampBuffer(baseBuf, logoBuf, s);
  await writeFile(urlToAbs(outUrl), stamped);
  await prisma.productImage.update({ where: { id: row.id }, data: { url: outUrl, originalUrl } });
  return true;
}

// ---- scope resolution -------------------------------------------------------
export type WatermarkScope = 'all' | 'category' | 'brand' | 'collection';
export type RunParams = { action: 'stamp' | 'remove'; scope: WatermarkScope; scopeId?: string; primaryOnly: boolean; onlyUnstamped: boolean };

function imageWhere(p: RunParams): Prisma.ProductImageWhereInput {
  const productWhere: Prisma.ProductWhereInput = {};
  if (p.scope === 'category' && p.scopeId) productWhere.categories = { some: { id: p.scopeId } };
  if (p.scope === 'brand' && p.scopeId) productWhere.brandId = p.scopeId;
  if (p.scope === 'collection' && p.scopeId) productWhere.collections = { some: { id: p.scopeId } };
  return {
    ...(Object.keys(productWhere).length ? { product: productWhere } : {}),
    ...(p.primaryOnly ? { isPrimary: true } : {}),
    ...(p.action === 'stamp' && p.onlyUnstamped ? { originalUrl: null, url: { not: { endsWith: WM_SUFFIX } } } : {}),
    ...(p.action === 'remove' ? { OR: [{ originalUrl: { not: null } }, { url: { endsWith: WM_SUFFIX } }] } : {}),
  };
}

export async function countScope(p: RunParams): Promise<number> {
  return prisma.productImage.count({ where: imageWhere(p) });
}

// ---- run (called by the worker; safe to run inline for small sets) ----------
export async function runWatermark(p: RunParams): Promise<{ done: number; failed: number; total: number }> {
  const rows = await prisma.productImage.findMany({ where: imageWhere(p), select: { id: true, url: true, originalUrl: true }, take: 20000 });
  let done = 0, failed = 0;

  if (p.action === 'remove') {
    for (const row of rows) {
      const original = row.originalUrl ?? (isStamped(row.url) ? deriveOriginal(row.url) + '.webp' : null);
      if (!original) { failed++; continue; }
      await prisma.productImage.update({ where: { id: row.id }, data: { url: original, originalUrl: null } });
      if (isStamped(row.url)) await unlink(urlToAbs(row.url)).catch(() => {});
      done++;
    }
    await recordRun(p, done, failed, rows.length);
    return { done, failed, total: rows.length };
  }

  const s = await getWatermarkSettings();
  const logoUrl = await watermarkLogoUrl(s);
  const logoBuf = logoUrl ? await readAsset(logoUrl) : null;
  if (!logoBuf) { await recordRun(p, 0, rows.length, rows.length, 'no_logo'); return { done: 0, failed: rows.length, total: rows.length }; }
  for (const row of rows) {
    try {
      if (await stampRow(row, s, logoBuf)) done++; else failed++;
    } catch {
      failed++;
    }
  }
  await recordRun(p, done, failed, rows.length);
  return { done, failed, total: rows.length };
}

export type WatermarkRun = { at: string; action: string; scope: string; done: number; failed: number; total: number; error?: string };
async function recordRun(p: RunParams, done: number, failed: number, total: number, error?: string) {
  const value = JSON.stringify({ action: p.action, scope: p.scope, done, failed, total, error } satisfies Omit<WatermarkRun, 'at'>);
  await prisma.setting.upsert({ where: { key: 'watermark.lastRunData' }, update: { value }, create: { key: 'watermark.lastRunData', value } });
  await prisma.setting.upsert({ where: { key: 'watermark.lastRunAt' }, update: { value: new Date().toISOString() }, create: { key: 'watermark.lastRunAt', value: new Date().toISOString() } });
}

export async function getLastRun(): Promise<WatermarkRun | null> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: ['watermark.lastRunData', 'watermark.lastRunAt'] } } });
    const data = rows.find((r) => r.key === 'watermark.lastRunData')?.value;
    const at = rows.find((r) => r.key === 'watermark.lastRunAt')?.value;
    if (!data) return null;
    return { at: at ?? '', ...(JSON.parse(data) as Omit<WatermarkRun, 'at'>) };
  } catch {
    return null;
  }
}

/** Auto-stamp a freshly-uploaded product image (returns the stamped url or the
 *  original on any failure). Used by the upload route when autoStamp is on. */
export async function autoStampUpload(url: string): Promise<{ url: string; originalUrl?: string }> {
  try {
    const s = await getWatermarkSettings();
    if (!s.autoStamp) return { url };
    const logoUrl = await watermarkLogoUrl(s);
    const [baseBuf, logoBuf] = await Promise.all([readAsset(url), logoUrl ? readAsset(logoUrl) : Promise.resolve(null)]);
    if (!baseBuf || !logoBuf) return { url };
    const outUrl = stampedUrlFor(url);
    await writeFile(urlToAbs(outUrl), await stampBuffer(baseBuf, logoBuf, s));
    return { url: outUrl, originalUrl: url };
  } catch {
    return { url };
  }
}
