import { beforeEach, describe, expect, it } from 'vitest';
import { setAuthAccount, type AuthAccount } from '../auth/session';
import { signInTestUser } from '../test/authAccount';
import { canEditCrag, canManageCrag, canManageMembers } from './permissions';

function signIn(uid: string, roles: AuthAccount['roles']): void {
  setAuthAccount({
    uid,
    email: `${uid}@example.com`,
    emailVerified: true,
    superadmin: false,
    roles,
    getIdToken: async () => 'token',
  });
}

describe('canManageCrag', () => {
  beforeEach(() => {
    setAuthAccount(null);
  });

  it('rejects management when signed out', () => {
    expect(canManageCrag('shulaveri')).toBe(false);
  });

  it('rejects a signed-in user with no role on this crag', () => {
    signIn('visitor', {});
    expect(canManageCrag('shulaveri')).toBe(false);
  });

  it('allows a superadmin without a membership row', () => {
    signInTestUser();
    expect(canManageCrag('shulaveri')).toBe(true);
  });

  it.each(['owner', 'admin'] as const)('allows a %s of this crag', (role) => {
    signIn('member', { roshka: role });
    expect(canManageCrag('roshka')).toBe(true);
    expect(canManageCrag('other')).toBe(false);
  });
});

describe('canEditCrag', () => {
  beforeEach(() => {
    setAuthAccount(null);
  });

  it('rejects an explorer crag when signed out', () => {
    expect(canEditCrag({ id: 'roshka', source: 'explorer' })).toBe(false);
  });

  it('rejects an explorer crag for a signed-in user with no role', () => {
    signIn('visitor', {});
    expect(canEditCrag({ id: 'roshka', source: 'explorer' })).toBe(false);
  });

  it('allows an explorer crag for a superadmin', () => {
    signInTestUser();
    expect(canEditCrag({ id: 'roshka', source: 'explorer' })).toBe(true);
  });

  it('allows an explorer crag for an admin of that crag', () => {
    signIn('admin-user', { roshka: 'admin' });
    expect(canEditCrag({ id: 'roshka', source: 'explorer' })).toBe(true);
  });

  it('rejects a crag with no source when signed out', () => {
    expect(canEditCrag({ id: 'roshka' })).toBe(false);
  });

  it('allows a crag that has no source yet for a superadmin', () => {
    signInTestUser();
    expect(canEditCrag({ id: 'roshka' })).toBe(true);
  });

  it('rejects an extracted crag when signed out', () => {
    expect(canEditCrag({ id: 'shulaveri', source: 'external' })).toBe(false);
  });

  it('rejects an extracted crag for a superadmin and for its owner', () => {
    signInTestUser();
    expect(canEditCrag({ id: 'shulaveri', source: 'external' })).toBe(false);

    signIn('owner-user', { shulaveri: 'owner' });
    expect(canEditCrag({ id: 'shulaveri', source: 'external' })).toBe(false);
  });
});

describe('canManageMembers', () => {
  beforeEach(() => {
    setAuthAccount(null);
  });

  it('rejects membership changes when signed out', () => {
    expect(canManageMembers('roshka')).toBe(false);
  });

  it('lets a superadmin change members without a membership row', () => {
    signInTestUser();
    expect(canManageMembers('roshka')).toBe(true);
  });

  it('lets an owner change members and keeps an admin read-only', () => {
    signIn('owner-user', { roshka: 'owner' });
    expect(canManageMembers('roshka')).toBe(true);
    expect(canManageMembers('other')).toBe(false);

    signIn('admin-user', { roshka: 'admin' });
    expect(canManageMembers('roshka')).toBe(false);
  });
});
