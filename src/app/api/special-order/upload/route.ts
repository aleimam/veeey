import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { toWebp } from '@/lib/images';
import { storeImage } from '@/lib/storage';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/**
 * Public image upload for the special-order request form (customers may attach
 * reference photos). Rate-limited per IP and image-only — no auth, so it's kept
 * deliberately small and abuse-resistant.
 */
export async function POST(req: Request) {
  const ip = await clientIp();
  if (!rateLimit(`so-upload:${ip}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'not an image' }, { status: 415 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'too large' }, { status: 413 });

  const webp = await toWebp(Buffer.from(await file.arrayBuffer()), 1400);
  const name = `so-${Date.now()}-${randomBytes(4).toString('hex')}.webp`;
  const stored = await storeImage(webp, name);
  return NextResponse.json(stored);
}
