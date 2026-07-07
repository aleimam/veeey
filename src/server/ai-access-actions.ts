'use server';

import { createApiKey, setApiKeyActive, setApiKeyScopes, deleteApiKey } from '@/lib/api-key-service';
import { approveProposal, rejectProposal } from '@/lib/ai-proposal-service';

/** AI-access admin actions. Permission (settings.manage) is enforced inside each
 *  service call; the client refreshes the route after mutating. */

export async function createApiKeyAction(name: string, scopes: string[]): Promise<{ token: string }> {
  const { token } = await createApiKey(name, scopes);
  return { token };
}

export async function setApiKeyScopesAction(id: string, scopes: string[]): Promise<void> {
  await setApiKeyScopes(id, scopes);
}

export async function setApiKeyActiveAction(id: string, active: boolean): Promise<void> {
  await setApiKeyActive(id, active);
}

export async function deleteApiKeyAction(id: string): Promise<void> {
  await deleteApiKey(id);
}

export async function approveProposalAction(id: string): Promise<{ ok: boolean; message: string }> {
  const p = await approveProposal(id);
  const result = p.resultJson as { ok?: boolean; summary?: string; error?: string } | null;
  return { ok: p.status === 'APPLIED', message: result?.summary ?? result?.error ?? p.status };
}

export async function rejectProposalAction(id: string, note?: string): Promise<void> {
  await rejectProposal(id, note);
}
