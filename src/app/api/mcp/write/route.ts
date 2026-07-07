import { authenticateMcp } from '@/lib/mcp-auth';
import { requiredWriteScope } from '@/lib/mcp-scopes';
import { createProposal } from '@/lib/ai-proposal-service';
import { audit } from '@/lib/audit';

/**
 * AI-MCP write endpoint (FR-MCP-03). AI writes are **staged, never applied live**
 * — the request is recorded as an AiProposal for a human to approve/reject in
 * /admin/ai-approvals, and returns 202. The caller's key must hold the scope the
 * action requires.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const auth = await authenticateMcp(req, raw);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: { action?: string; entityType?: string; entityId?: string; payload?: unknown };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return Response.json({ error: 'bad_json' }, { status: 400 });
  }

  const action = String(body.action ?? '').trim();
  if (!action) return Response.json({ error: 'missing_action' }, { status: 400 });

  const need = requiredWriteScope(action);
  if (!auth.scopes.includes(need)) return Response.json({ error: 'forbidden', need }, { status: 403 });

  const entityType = String(body.entityType ?? 'unknown');
  const entityId = body.entityId ? String(body.entityId) : null;
  const proposal = await createProposal({ clientId: auth.clientId, clientName: auth.name, action, entityType, entityId, payload: body.payload ?? {} });

  await audit({
    actorType: 'AI',
    action: 'ai.write.proposed',
    entityType,
    entityId: entityId ?? undefined,
    data: { action, proposalId: proposal.id, by: auth.name },
  });

  return Response.json(
    { status: 'pending_approval', proposalId: proposal.id, message: 'AI writes require human approval (FR-MCP-03). Recorded for review.' },
    { status: 202 },
  );
}
