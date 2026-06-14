import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Pluggable media storage (FR-CAT-06). P0/dev driver writes to public/uploads
 * and serves from /uploads; production swaps in an object-store/CDN driver
 * behind this same interface (set STORAGE_DRIVER + bucket env later).
 */
export interface StoredFile {
  url: string;
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function storeImage(buffer: Buffer, filename: string): Promise<StoredFile> {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, safe), buffer);
  return { url: `/uploads/${safe}` };
}
