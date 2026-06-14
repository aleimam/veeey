import { mcpEnabled, verifyMcp } from '@/lib/mcp-auth';
import { audit } from '@/lib/audit';

/**
 * AI-MCP write endpoint (FR-MCP-03). AI writes are **staged, never applied live**
 * — the request is recorded in the audit log as an AI proposal for human approval
 * and returns 202. High-impact actions are gated on a human per AGENTS.md §8.
 */
export async function POST(req: Request) {
  if (!mcpEnabled()) return Response.json({ error: 'mcp_disabled' }, { status: 503 });
  const raw = await req.text();
  if (!verifyMcp(req.headers, raw)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: { action?: string; entityType?: string; entityId?: string; payload?: unknown };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return Response.json({ error: 'bad_json' }, { status: 400 });
  }

  await audit({
    actorType: 'AI',
    action: 'ai.write.proposed',
    entityType: String(body.entityType ?? 'unknown'),
    entityId: body.entityId ? String(body.entityId) : undefined,
    data: { action: body.action ?? null, payload: body.payload ?? null },
  });

  return Response.json(
    { status: 'pending_approval', message: 'AI writes require human approval (FR-MCP-03). Recorded for review.' },
    { status: 202 },
  );
}
