import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readMemberships } from './memberships';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('readMemberships', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('maps owner and admin rows and sends the ID token', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      memberships: [
        { cragId: 'roshka', role: 'admin' },
        { cragId: 'other', role: 'owner' },
      ],
    }));

    await expect(readMemberships('id-token')).resolves.toEqual({
      roshka: 'admin',
      other: 'owner',
    });
    expect(fetch).toHaveBeenCalledWith('/api/me/memberships', {
      headers: { Authorization: 'Bearer id-token' },
    });
  });

  it('returns an empty map when the user has no rows', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ memberships: [] }));
    await expect(readMemberships('id-token')).resolves.toEqual({});
  });

  it('throws when the request fails', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));
    await expect(readMemberships('id-token')).rejects.toThrow('Failed to read crag membership (401)');
  });

  it('throws when the request does not complete', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    await expect(readMemberships('id-token')).rejects.toThrow('network down');
  });

  it.each([
    ['memberships is missing', {}],
    ['memberships is not a list', { memberships: {} }],
    ['a row is not an object', { memberships: [null] }],
    ['a row has no crag id', { memberships: [{ role: 'admin' }] }],
    ['a row has a role other than owner or admin', { memberships: [{ cragId: 'roshka', role: 'editor' }] }],
  ])('throws when %s', async (_label, body) => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(body));
    await expect(readMemberships('id-token')).rejects.toThrow(
      'Crag membership returned an unexpected response',
    );
  });
});
