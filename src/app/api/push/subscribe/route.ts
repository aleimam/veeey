import { getCurrentUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';

/** Store / remove a Web Push subscription for the signed-in customer (FR-NOT-02). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerId) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  const p256dh = body?.keys?.p256dh as string | undefined;
  const auth = body?.keys?.auth as string | undefined;
  if (!endpoint || !p256dh || !auth) return new Response('bad request', { status: 400 });

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { customerId: user.customerId, p256dh, auth },
    create: { customerId: user.customerId, endpoint, p256dh, auth },
  });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request) {
  const endpoint = (await req.json().catch(() => null))?.endpoint as string | undefined;
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return new Response(null, { status: 204 });
}
