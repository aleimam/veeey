import { describe, it, expect } from 'vitest';
import { sanitizeScopes, requiredWriteScope, hasScope, ALL_SCOPES } from './mcp-scopes';

describe('mcp scopes', () => {
  it('sanitizeScopes keeps only valid scopes and dedupes', () => {
    expect(sanitizeScopes(['catalog:read', 'catalog:read', 'bogus', 42, 'orders:read'])).toEqual(['catalog:read', 'orders:read']);
    expect(sanitizeScopes('nope')).toEqual([]);
    expect(sanitizeScopes(null)).toEqual([]);
  });

  it('requiredWriteScope maps an action to the scope it needs', () => {
    expect(requiredWriteScope('product.update')).toBe('catalog:write');
    expect(requiredWriteScope('review.moderate')).toBe('reviews:moderate');
    expect(requiredWriteScope('content.page.update')).toBe('content:write');
    expect(requiredWriteScope('blog.publish')).toBe('content:write');
    expect(requiredWriteScope('anything.else')).toBe('catalog:write');
  });

  it('hasScope checks membership', () => {
    expect(hasScope(['catalog:read'], 'catalog:read')).toBe(true);
    expect(hasScope(['catalog:read'], 'catalog:write')).toBe(false);
  });

  it('ALL_SCOPES covers every declared scope', () => {
    expect(ALL_SCOPES).toContain('catalog:read');
    expect(ALL_SCOPES).toContain('catalog:write');
  });
});
