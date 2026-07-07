import { verifySignature } from '@/lib/hmac';
import { bearerToken } from '@/lib/api-key';
import { authenticateToken } from '@/lib/api-key-service';
import { ALL_SCOPES, type McpScope } from '@/lib/mcp-scopes';

/**
 * AI-MCP auth (FR-MCP-01). Two ways in:
 *  1. **Bearer API key** (preferred) — `Authorization: Bearer veeey_mcp_…`,
 *     resolved to an IntegrationClient(AI_MCP) with its granted scopes. This is
 *     what an admin creates in /admin/ai-keys to connect Claude / ChatGPT.
 *  2. **Legacy env HMAC** — `MCP_API_SECRET` + x-veeey-timestamp/signature over
 *     `${ts}.${rawBody}`. Full scopes, kept for backward-compat.
 */
export const mcpEnabled = () => !!process.env.MCP_API_SECRET;

export function verifyMcp(headers: Headers, rawBody: string): boolean {
  const secret = process.env.MCP_API_SECRET;
  if (!secret) return false;
  const ts = headers.get('x-veeey-timestamp') ?? '';
  const sig = headers.get('x-veeey-signature') ?? '';
  if (!ts || !sig) return false;
  return verifySignature(secret, ts, rawBody, sig, Date.now());
}

export type McpPrincipal = { clientId: string | null; name: string; scopes: McpScope[] };

/** Authenticate an MCP request → the caller's scopes, or null if unauthorized. */
export async function authenticateMcp(req: Request, rawBody: string): Promise<McpPrincipal | null> {
  const token = bearerToken(req.headers.get('authorization'));
  if (token) {
    const client = await authenticateToken(token);
    return client ? { clientId: client.id, name: client.name, scopes: client.scopes } : null;
  }
  if (mcpEnabled() && verifyMcp(req.headers, rawBody)) {
    return { clientId: null, name: 'legacy-hmac', scopes: [...ALL_SCOPES] };
  }
  return null;
}
