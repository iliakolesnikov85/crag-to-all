import { setAuthAccount, type AuthAccount } from '../auth/session';

const testAuthAccount: AuthAccount = {
  uid: 'test-user',
  email: 'editor@example.com',
  emailVerified: true,
  superadmin: true,
  roles: null,
  getIdToken: () => Promise.resolve('test-token'),
};

export function signInTestUser(): void {
  setAuthAccount(testAuthAccount);
}
