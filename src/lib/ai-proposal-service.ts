import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { applyAiProposal } from '@/lib/ai-apply';

/** Staged AI writes (FR-MCP-03): the MCP write endpoint records a proposal; an
 *  admin approves (→ applied via the whitelisted applier) or rejects it. */

export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'FAILED';

export async function createProposal(input: {
  clientId: string | null;
  clientName: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload: unknown;
}) {
  return prisma.aiProposal.create({
    data: {
      clientId: input.clientId,
      clientName: input.clientName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      payloadJson: (input.payload ?? {}) as Prisma.InputJsonValue,
      status: 'PENDING',
    },
  });
}

export function listProposals(status?: ProposalStatus, limit = 100) {
  return prisma.aiProposal.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export function pendingProposalCount() {
  return prisma.aiProposal.count({ where: { status: 'PENDING' } });
}

export async function approveProposal(id: string) {
  const user = await requirePermission('settings.manage');
  const p = await prisma.aiProposal.findUniqueOrThrow({ where: { id } });
  if (p.status !== 'PENDING') throw new Error('NOT_PENDING');
  const result = await applyAiProposal(p.action, p.payloadJson);
  const updated = await prisma.aiProposal.update({
    where: { id },
    data: {
      status: result.ok ? 'APPLIED' : 'FAILED',
      reviewedById: user.id,
      reviewedAt: new Date(),
      resultJson: result as unknown as Prisma.InputJsonValue,
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: result.ok ? 'ai.proposal.applied' : 'ai.proposal.failed', entityType: 'AiProposal', entityId: id, data: { action: p.action, result } });
  return updated;
}

export async function rejectProposal(id: string, note?: string) {
  const user = await requirePermission('settings.manage');
  const p = await prisma.aiProposal.findUniqueOrThrow({ where: { id } });
  if (p.status !== 'PENDING') throw new Error('NOT_PENDING');
  const updated = await prisma.aiProposal.update({
    where: { id },
    data: { status: 'REJECTED', reviewedById: user.id, reviewedAt: new Date(), note: note?.slice(0, 500) ?? null },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'ai.proposal.rejected', entityType: 'AiProposal', entityId: id });
  return updated;
}
