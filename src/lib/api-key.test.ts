import { describe, it, expect } from 'vitest';
import { generateToken, hashToken, tokenPrefix, bearerToken, TOKEN_PREFIX } from './api-key';

describe('api-key helpers', () => {
  it('generateToken is prefixed, long, and unique', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(a.length).toBeGreaterThan(TOKEN_PREFIX.length + 20);
    expect(a).not.toBe(b);
  });

  it('hashToken is deterministic sha256 hex and hides the token', () => {
    const tok = 'veeey_mcp_example';
    expect(hashToken(tok)).toBe(hashToken(tok));
    expect(hashToken(tok)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(tok)).not.toContain('example');
    expect(hashToken(' veeey_mcp_example ')).toBe(hashToken(tok)); // trims
  });

  it('tokenPrefix keeps a short non-secret head', () => {
    const tok = TOKEN_PREFIX + 'ABCDEFGHIJKL';
    expect(tokenPrefix(tok)).toBe(TOKEN_PREFIX + 'ABCDEF');
  });

  it('bearerToken parses the Authorization header', () => {
    expect(bearerToken('Bearer veeey_mcp_x')).toBe('veeey_mcp_x');
    expect(bearerToken('bearer  spaced ')).toBe('spaced');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
