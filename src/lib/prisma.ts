import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { TRACKED_MODELS, CREATE_SKIP_MODELS, diffRecords, snapshotRecord, entityIdOf } from '@/lib/change-log';

/**
 * Singleton Prisma client. Prisma 7's `prisma-client` generator uses driver
 * adapters, so we pass the node-postgres adapter (connection string read from
 * env, NFR-07). The singleton avoids exhausting connections during dev reload.
 *
 * The exported client carries the field-level change-log extension (owner
 * batch #6): writes on TRACKED_MODELS are diffed before/after and recorded in
 * AuditLog as `change.*` entries — centrally, so every service gets history
 * without per-callsite wiring. Logging is fire-and-forget on the BASE client
 * (no recursion, never blocks or fails the business write).
 */
const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const base = globalForPrisma.prismaBase ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaBase = base;
}

type Row = Record<string, unknown>;

const delegateOf = (model: string) =>
  (base as unknown as Record<string, { findUnique: (a: { where: unknown }) => Promise<Row | null> }>)[
    model.charAt(0).toLowerCase() + model.slice(1)
  ];

/** Who is writing — the session user when in a request scope, else SYSTEM
 *  (jobs, webhooks, sync). Lazy import breaks the auth ⇄ prisma module cycle. */
async function resolveActor(): Promise<{ actorType: 'USER' | 'SYSTEM'; actorId: string | null }> {
  try {
    const { getCurrentUser } = await import('@/lib/auth-guards');
    const u = await getCurrentUser();
    return u?.id ? { actorType: 'USER', actorId: u.id } : { actorType: 'SYSTEM', actorId: null };
  } catch {
    return { actorType: 'SYSTEM', actorId: null };
  }
}

function record(model: string, action: string, entityId: string | null, data?: object) {
  void (async () => {
    try {
      const actor = await resolveActor();
      await base.auditLog.create({
        data: { ...actor, action, entityType: model, entityId, dataJson: data as object | undefined },
      });
    } catch (e) {
      console.error('change-log write failed', e);
    }
  })();
}

export const prisma = base.$extends({
  name: 'field-change-log',
  query: {
    $allModels: {
      async create({ model, args, query }) {
        const result = await query(args);
        if (TRACKED_MODELS.has(model) && !CREATE_SKIP_MODELS.has(model)) {
          record(model, 'change.create', entityIdOf(result));
        }
        return result;
      },
      async update({ model, args, query }) {
        if (!TRACKED_MODELS.has(model)) return query(args);
        const before = await delegateOf(model)
          ?.findUnique({ where: (args as { where: unknown }).where })
          .catch(() => null);
        const result = await query(args);
        const changes = diffRecords(model, before, result as Row);
        if (changes.length) record(model, 'change.update', entityIdOf(result) ?? entityIdOf(before), { changes });
        return result;
      },
      async upsert({ model, args, query }) {
        if (!TRACKED_MODELS.has(model)) return query(args);
        const before = await delegateOf(model)
          ?.findUnique({ where: (args as { where: unknown }).where })
          .catch(() => null);
        const result = await query(args);
        if (!before) {
          if (!CREATE_SKIP_MODELS.has(model)) record(model, 'change.create', entityIdOf(result));
        } else {
          const changes = diffRecords(model, before, result as Row);
          if (changes.length) record(model, 'change.update', entityIdOf(result) ?? entityIdOf(before), { changes });
        }
        return result;
      },
      async delete({ model, args, query }) {
        if (!TRACKED_MODELS.has(model)) return query(args);
        const before = await delegateOf(model)
          ?.findUnique({ where: (args as { where: unknown }).where })
          .catch(() => null);
        const result = await query(args);
        record(
          model,
          'change.delete',
          entityIdOf(before) ?? entityIdOf(result),
          before ? { snapshot: snapshotRecord(model, before) } : undefined,
        );
        return result;
      },
      async updateMany({ model, args, query }) {
        const result = await query(args);
        const count = (result as { count?: number })?.count ?? 0;
        if (TRACKED_MODELS.has(model) && count > 0) {
          const data = (args as { data?: unknown }).data;
          const fields = data && typeof data === 'object' ? Object.keys(data as object) : [];
          record(model, 'change.updateMany', null, { count, fields });
        }
        return result;
      },
      async deleteMany({ model, args, query }) {
        const result = await query(args);
        const count = (result as { count?: number })?.count ?? 0;
        if (TRACKED_MODELS.has(model) && count > 0) record(model, 'change.deleteMany', null, { count });
        return result;
      },
    },
  },
});
