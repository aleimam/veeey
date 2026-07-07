import { createHash, randomBytes } from 'node:crypto';

/**
 * AI/MCP bearer-token helpers (pure). The token is shown to the admin once at
 * creation; only its sha256 hash is stored. `veeey_mcp_` prefix makes leaked
 * tokens greppable / identifiable.
 */
export const TOKEN_PREFIX = 'veeey_mcp_';

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

/** Non-secret leading chars kept for display (e.g. "veeey_mcp_A1b2c3"). */
export function tokenPrefix(token: string): string {
  return token.slice(0, TOKEN_PREFIX.length + 6);
}

/** Extract a bearer token from an Authorization header, or null. */
export function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
