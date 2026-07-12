import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

/**
 * Serve uploaded media from public/uploads at REQUEST time.
 *
 * `next start` only serves files that existed in `public/` at build time, so
 * runtime uploads (admin logos, favicon, product images) 404 until the next
 * build. This handler reads the file from disk on every request, making uploads
 * available immediately. Build-time files are still served by the static layer
 * (which runs first); only not-yet-built files fall through to here.
 */
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const TYPES: Record<string, string> = {
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif',
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const rel = (parts ?? []).join('/');
  const full = path.join(UPLOAD_DIR, rel);
  // Path-traversal guard — the resolved path must stay inside UPLOAD_DIR.
  if (full !== UPLOAD_DIR && !full.startsWith(UPLOAD_DIR + path.sep)) {
    return new NextResponse('Not found', { status: 404 });
  }
  try {
    const buf = await readFile(full);
    const type = TYPES[path.extname(full).toLowerCase()] ?? 'application/octet-stream';
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
