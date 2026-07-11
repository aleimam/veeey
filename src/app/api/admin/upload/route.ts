import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-guards';
import { toWebp, toFaviconPng } from '@/lib/images';
import { storeImage } from '@/lib/storage';

// Image upload (drag/paste/file) -> WebP -> storage. RBAC-gated (FR-CAT-06).
// kind=icon (branding favicon) -> 64px PNG instead, gated on settings.manage.
export async function POST(req: Request) {
  const form = await req.formData();
  const kind = form.get('kind') === 'icon' ? 'icon' : 'image';
  try {
    await requirePermission(kind === 'icon' ? 'settings.manage' : 'catalog.write');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'not an image' }, { status: 415 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  const output = kind === 'icon' ? await toFaviconPng(input) : await toWebp(input);
  const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${kind === 'icon' ? 'png' : 'webp'}`;
  const stored = await storeImage(output, name);
  return NextResponse.json(stored);
}
