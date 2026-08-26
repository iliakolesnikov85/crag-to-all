import stringify from 'fast-json-stable-stringify';

/** SHA-256 hex of stable-stringified JSON. */
export async function computeCragDataChecksum(data: unknown): Promise<string> {
  const canonical = stringify(data);
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
