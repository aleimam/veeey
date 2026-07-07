import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { generateToken, hashToken, tokenPrefix } from '@/lib/api-key';
import { sanitizeScopes, type McpScope } from '@/lib/mcp-scopes';

/** AI/MCP API keys are IntegrationClient rows with kind=AI_MCP. The plaintext
 *  token is returned only once (on create); we persist just its hash. */

export async function listApiKeys() {
  return prisma.integrationClient.findMany({
    where: { kind: 'AI_MCP' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, keyPrefix: true, scopesJson: true, active: true, lastUsedAt: true, createdAt: true },
  });
}

export async function createApiKey(name: string, scopes: string[]): Promise<{ id: string; token: string }> {
  const user = await requirePermission('settings.manage');
  const token = generateToken();
  const clean = sanitizeScopes(scopes);
  const client = await prisma.integrationClient.create({
    data: {
      clientId: `mcp_${randomBytes(8).toString('hex')}`,
      name: name.trim() || 'AI key',
      secretHash: hashToken(token),
      kind: 'AI_MCP',
      scopesJson: clean,
      keyPrefix: tokenPrefix(token),
      active: true,
      createdById: user.id,
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'apikey.create', entityType: 'IntegrationClient', entityId: client.id, data: { name: client.name, scopes: clean } });
  return { id: client.id, token };
}

export async function setApiKeyScopes(id: string, scopes: string[]): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.integrationClient.update({ where: { id }, data: { scopesJson: sanitizeScopes(scopes) } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'apikey.scopes', entityType: 'IntegrationClient', entityId: id, data: { scopes: sanitizeScopes(scopes) } });
}

export async function setApiKeyActive(id: string, active: boolean): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.integrationClient.update({ where: { id }, data: { active } });
  await audit({ actorType: 'USER', actorId: user.id, action: active ? 'apikey.enable' : 'apikey.revoke', entityType: 'IntegrationClient', entityId: id });
}

export async function deleteApiKey(id: string): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.integrationClient.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'apikey.delete', entityType: 'IntegrationClient', entityId: id });
}

/** MCP auth path: resolve a bearer token to its active client + scopes, or null.
 *  Not permission-gated — it authenticates the caller's own key. */
export async function authenticateToken(token: string): Promise<{ id: string; name: string; scopes: McpScope[] } | null> {
  const client = await prisma.integrationClient.findFirst({
    where: { kind: 'AI_MCP', secretHash: hashToken(token), active: true },
    select: { id: true, name: true, scopesJson: true },
  });
  if (!client) return null;
  try {
    await prisma.integrationClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } });
  } catch {
    /* lastUsedAt is best-effort — never fail auth over it */
  }
  return { id: client.id, name: client.name, scopes: sanitizeScopes(client.scopesJson) };
}
