import { describe, expect, it } from 'vitest';
import { sampleCragData } from '../test/fixtures/cragData';
import { computeCragDataChecksum } from './cragChecksum';

describe('computeCragDataChecksum', () => {
  it('returns a 64-character hex SHA-256', async () => {
    const hash = await computeCragDataChecksum({ a: 1 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is independent of object key order', async () => {
    const left = await computeCragDataChecksum({
      z: 1,
      name: 'x',
      nested: { b: 2, a: 1 },
    });
    const right = await computeCragDataChecksum({
      name: 'x',
      nested: { a: 1, b: 2 },
      z: 1,
    });
    expect(left).toBe(right);
  });

  it('changes when the payload changes', async () => {
    const original = await computeCragDataChecksum(sampleCragData);
    const mutated = await computeCragDataChecksum({
      ...sampleCragData,
      name: 'Other Crag',
    });
    expect(original).not.toBe(mutated);
  });
});
