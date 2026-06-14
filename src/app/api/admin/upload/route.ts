import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-guards';
import { toWebp } from '@/lib/images';
import { storeImage } from '@/lib/storage';

// Image upload (drag/paste/file) -> WebP -> storage. RBAC-gated (FR-CAT-06).
export async function POST(req: Request) {
  try {
    await requirePermission('catalog.write');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'not an image' }, { status: 415 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  const webp = await toWebp(input);
  const name = `${Date.now()}-${randomBytes(4).toString('hex')}.webp`;
  const stored = await storeImage(webp, name);
  return NextResponse.json(stored);
}
