import { describe, expect, it } from 'vitest';
import { canEditCrag, canManageCrag } from './permissions';

describe('canManageCrag', () => {
  it('allows management until real auth exists', () => {
    expect(canManageCrag('shulaveri')).toBe(true);
  });
});

describe('canEditCrag', () => {
  it('allows an explorer crag', () => {
    expect(canEditCrag({ cragId: 'roshka', source: 'explorer' })).toBe(true);
  });

  it('allows a crag that has no source yet', () => {
    expect(canEditCrag({ cragId: 'roshka' })).toBe(true);
  });

  it('rejects an extracted crag', () => {
    expect(canEditCrag({ cragId: 'shulaveri', source: 'external' })).toBe(false);
  });
});
