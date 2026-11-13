import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken } from './auth';

const authMocks = vi.hoisted(() => ({
  readIdToken: vi.fn(async (): Promise<string | null> => 'id-token'),
}));

vi.mock('../auth/firebaseAuth', () => ({
  readIdToken: authMocks.readIdToken,
}));

describe('getAccessToken', () => {
  beforeEach(() => {
    authMocks.readIdToken.mockReset();
    authMocks.readIdToken.mockResolvedValue('id-token');
  });

  it('returns the Firebase ID token when someone is signed in', async () => {
    await expect(getAccessToken()).resolves.toBe('id-token');
    expect(authMocks.readIdToken).toHaveBeenCalledTimes(1);
  });

  it('returns null when nobody is signed in', async () => {
    authMocks.readIdToken.mockResolvedValue(null);
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it('logs and returns null when the token cannot be read', async () => {
    const failure = new Error('token down');
    authMocks.readIdToken.mockRejectedValue(failure);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getAccessToken()).resolves.toBeNull();

    expect(error).toHaveBeenCalledWith('Failed to read the sign-in token:', failure);
    error.mockRestore();
  });
});
