import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-guards';
import { canAccessAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

/**
 * Live slug-availability check for admin edit forms (V3-TAG-2). Returns whether
 * a slug is free for the given entity, so the form can warn before save that a
 * duplicate will be auto-suffixed. Read-only + admin-gated; unknown entities
 * are reported available (no-op) so the field never blocks.
 */
type Checker = (slug: string, id: string | null) => Promise<boolean>; // true = taken
const takenUnique = async (find: () => Promise<{ id: string } | null>, id: string | null): Promise<boolean> => {
  const found = await find();
  return !!found && found.id !== id;
};
const CHECKERS: Record<string, Checker> = {
  tag: (slug, id) => takenUnique(() => prisma.tag.findUnique({ where: { slug }, select: { id: true } }), id),
  brand: (slug, id) => takenUnique(() => prisma.brand.findUnique({ where: { slug }, select: { id: true } }), id),
  category: (slug, id) => takenUnique(() => prisma.category.findUnique({ where: { slug }, select: { id: true } }), id),
  collection: (slug, id) => takenUnique(() => prisma.collection.findUnique({ where: { slug }, select: { id: true } }), id),
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.permissions)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const entity = url.searchParams.get('entity') ?? '';
  const slug = (url.searchParams.get('slug') ?? '').trim();
  const id = url.searchParams.get('id') || null;
  if (!slug) return NextResponse.json({ available: true });

  const checker = CHECKERS[entity];
  if (!checker) return NextResponse.json({ available: true });
  const isTaken = await checker(slug, id);
  return NextResponse.json({ available: !isTaken });
}
