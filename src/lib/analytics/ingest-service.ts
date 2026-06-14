import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { ingestSchema } from './events';

/**
 * Server-side ingest (FR-BEH-01/02). Writes the session + its events. A logged-in
 * customer is linked ONLY when the visitor granted full consent — otherwise the
 * journey stays anonymous (anonymized-until-consent). Best-effort by design.
 */
export async function ingestEvents(raw: unknown): Promise<void> {
  const data = ingestSchema.parse(raw);

  let customerId: string | null = null;
  if (data.consent === 'all') {
    const session = await auth();
    customerId = session?.user?.customerId ?? null;
  }

  await prisma.analyticsSession.upsert({
    where: { sessionId: data.sessionId },
    update: customerId ? { customerId } : {},
    create: {
      sessionId: data.sessionId,
      customerId,
      referrer: data.referrer,
      location: data.location,
      utmJson: (data.utm ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  await prisma.analyticsEvent.createMany({
    data: data.events.map((e) => ({
      sessionId: data.sessionId,
      customerId,
      type: e.name,
      path: e.path,
      propsJson: (e.props ?? undefined) as Prisma.InputJsonValue | undefined,
    })),
  });
}
