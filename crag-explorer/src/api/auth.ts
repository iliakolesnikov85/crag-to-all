/**
 * Bearer token for crag-management writes.
 * Reads stay anonymous until auth exists; this returns null until then.
 */
export async function getAccessToken(): Promise<string | null> {
  return null;
}
