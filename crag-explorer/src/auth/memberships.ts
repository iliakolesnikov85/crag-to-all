import type { CragMemberRole } from '@crag-to-all/shared-crag';

function membershipsUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  return `${base}/api/me/memberships`;
}

function isMemberRole(role: unknown): role is CragMemberRole {
  return role === 'owner' || role === 'admin';
}

/** Crag id → role for the signed-in user. Called once, with the new ID token. */
export async function readMemberships(idToken: string): Promise<Record<string, CragMemberRole>> {
  const response = await fetch(membershipsUrl(), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to read crag membership (${response.status})`);
  }
  const body = (await response.json()) as { memberships?: unknown };
  if (!Array.isArray(body.memberships)) {
    throw new Error('Crag membership returned an unexpected response');
  }
  const roles: Record<string, CragMemberRole> = {};
  for (const entry of body.memberships) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Crag membership returned an unexpected response');
    }
    const row = entry as { cragId?: unknown; role?: unknown };
    if (typeof row.cragId !== 'string' || !isMemberRole(row.role)) {
      throw new Error('Crag membership returned an unexpected response');
    }
    roles[row.cragId] = row.role;
  }
  return roles;
}
