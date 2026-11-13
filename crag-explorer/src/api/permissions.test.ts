import { beforeEach, describe, expect, it } from 'vitest';
import { setAuthAccount, type AuthAccount } from '../auth/session';
import { signInTestUser } from '../test/authAccount';
import { canEditCrag, canManageCrag } from './permissions';

function signIn(uid: string, roles: AuthAccount['roles']): void {
  setAuthAccount({
    uid,
    email: `${uid}@example.com`,
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
    expect(canEditCrag({ cragId: 'roshka', source: 'explorer' })).toBe(false);
  });

  it('rejects an explorer crag for a signed-in user with no role', () => {
    signIn('visitor', {});
    expect(canEditCrag({ cragId: 'roshka', source: 'explorer' })).toBe(false);
  });

  it('allows an explorer crag for a superadmin', () => {
    signInTestUser();
    expect(canEditCrag({ cragId: 'roshka', source: 'explorer' })).toBe(true);
  });

  it('allows an explorer crag for an admin of that crag', () => {
    signIn('admin-user', { roshka: 'admin' });
    expect(canEditCrag({ cragId: 'roshka', source: 'explorer' })).toBe(true);
  });

  it('rejects a crag with no source when signed out', () => {
    expect(canEditCrag({ cragId: 'roshka' })).toBe(false);
  });

  it('allows a crag that has no source yet for a superadmin', () => {
    signInTestUser();
    expect(canEditCrag({ cragId: 'roshka' })).toBe(true);
  });

  it('rejects an extracted crag when signed out', () => {
    expect(canEditCrag({ cragId: 'shulaveri', source: 'external' })).toBe(false);
  });

  it('rejects an extracted crag for a superadmin and for its owner', () => {
    signInTestUser();
    expect(canEditCrag({ cragId: 'shulaveri', source: 'external' })).toBe(false);

    signIn('owner-user', { shulaveri: 'owner' });
    expect(canEditCrag({ cragId: 'shulaveri', source: 'external' })).toBe(false);
  });
});
