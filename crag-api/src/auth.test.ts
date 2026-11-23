import { describe, expect, it } from 'vitest';
import { toAuthCaller } from './auth';

describe('toAuthCaller', () => {
  it('maps uid, email, and email_verified from the token', () => {
    expect(
      toAuthCaller({ uid: 'abc', email: ' A@Example.com ', email_verified: false }),
    ).toEqual({
      uid: 'abc',
      email: 'A@Example.com',
      emailVerified: false,
      superadmin: false,
    });
  });

  it('uses null and false when the token omits email claims', () => {
    expect(toAuthCaller({ uid: 'abc' })).toEqual({
      uid: 'abc',
      email: null,
      emailVerified: false,
      superadmin: false,
    });
    expect(toAuthCaller({ uid: 'abc', email: '   ', email_verified: true })).toEqual({
      uid: 'abc',
      email: null,
      emailVerified: true,
      superadmin: false,
    });
  });

  it('sets superadmin only when the custom claim is the boolean true', () => {
    expect(toAuthCaller({ uid: 'abc', superadmin: true }).superadmin).toBe(true);
    expect(toAuthCaller({ uid: 'abc', superadmin: 'true' }).superadmin).toBe(false);
    expect(toAuthCaller({ uid: 'abc', superadmin: 1 }).superadmin).toBe(false);
    expect(toAuthCaller({ uid: 'abc', superadmin: false }).superadmin).toBe(false);
    expect(toAuthCaller({ uid: 'abc' }).superadmin).toBe(false);
  });
});
