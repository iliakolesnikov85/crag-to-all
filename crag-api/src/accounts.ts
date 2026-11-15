import {
  accountsFailed,
  accountsUnavailable,
  HttpError,
} from './http';
import type { AuthAccountProfile, AuthDirectory, CragMemberResponse, CragMemberView } from './types';

const VERIFIED_ACCOUNT_MISSING = 'No verified account uses that email';

function verifiedAccountMissing(): HttpError {
  return new HttpError(404, {
    error: 'not_found',
    message: VERIFIED_ACCOUNT_MISSING,
  });
}

function profileByUid(profiles: readonly AuthAccountProfile[]): Map<string, AuthAccountProfile> {
  return new Map(profiles.map((profile) => [profile.uid, profile]));
}

/** Adds Auth name and email. A missing directory, or a missing user, leaves both null. */
export async function attachAccountProfiles(
  members: readonly CragMemberResponse[],
  directory: AuthDirectory | undefined,
): Promise<CragMemberView[]> {
  if (members.length === 0) return [];
  if (!directory) {
    return members.map((member) => ({ ...member, email: null, name: null }));
  }
  let profiles: AuthAccountProfile[];
  try {
    profiles = await directory.getByUids(members.map((member) => member.userId));
  } catch (error) {
    console.error('Failed to read Auth profiles for crag members:', error);
    throw accountsFailed();
  }
  const byUid = profileByUid(profiles);
  return members.map((member) => {
    const profile = byUid.get(member.userId);
    return {
      userId: member.userId,
      role: member.role,
      email: profile?.email ?? null,
      name: profile?.name ?? null,
    };
  });
}

/**
 * Exact email lookup. Missing and unverified accounts share one 404
 * so the response does not reveal an unverified account.
 */
export async function lookupVerifiedAccount(
  directory: AuthDirectory | undefined,
  email: string,
): Promise<{ uid: string; email: string; name: string | null }> {
  if (!directory) {
    console.error('Rejected an account lookup because no Auth directory is configured');
    throw accountsUnavailable();
  }
  let profile: AuthAccountProfile | null;
  try {
    profile = await directory.findByEmail(email);
  } catch (error) {
    console.error('Failed to look up a Firebase account by email:', error);
    throw accountsFailed();
  }
  if (!profile || profile.emailVerified !== true || !profile.email) {
    throw verifiedAccountMissing();
  }
  return { uid: profile.uid, email: profile.email, name: profile.name };
}
