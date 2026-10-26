import { describe, expect, it } from 'vitest';
import { canManageCrag } from './permissions';

describe('canManageCrag', () => {
  it('allows management until real auth exists', () => {
    expect(canManageCrag('shulaveri')).toBe(true);
  });
});
