import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { getSetting } from '@/lib/settings-service';

/**
 * Load the configured invoice letterhead as a PNG buffer for pdfkit (which can't
 * read WebP — the format uploads land in). Returns null when unset or unreadable,
 * so the invoice cleanly falls back to its plain header. Kept out of `invoice.ts`
 * so that module stays free of settings-service (→ next-auth) and unit-testable.
 */
export async function loadLetterheadPng(): Promise<Buffer | null> {
  const url = (await getSetting('invoice.letterhead'))?.trim();
  if (!url) return null;
  // Only local uploads (public/uploads/...) are supported; ignore anything else.
  if (!url.startsWith('/uploads/')) return null;
  try {
    const file = path.join(process.cwd(), 'public', url.replace(/^\/+/, ''));
    const bytes = fs.readFileSync(file);
    const sharp = (await import('sharp')).default;
    return await sharp(bytes).png().toBuffer();
  } catch {
    return null;
  }
}
