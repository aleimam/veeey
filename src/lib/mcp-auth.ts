import { verifySignature } from '@/lib/hmac';

/**
 * AI-MCP read API auth (FR-MCP-01). HMAC-SHA256 over `${timestamp}.${rawBody}`
 * with the shared `MCP_API_SECRET`. Env-gated: with no secret the API is disabled
 * (503). Headers: x-veeey-timestamp, x-veeey-signature.
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
