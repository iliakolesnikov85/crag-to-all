import { describe, expect, it } from 'vitest';
import { resolveTrailColor } from './mapUtils';

describe('resolveTrailColor', () => {
  it('accepts 3/6/8 digit hex and falls back otherwise', () => {
    expect(resolveTrailColor('#f00')).toBe('#f00');
    expect(resolveTrailColor('#ff0000')).toBe('#ff0000');
    expect(resolveTrailColor('#ff000080')).toBe('#ff000080');
    expect(resolveTrailColor('red')).toBe('#c45c26');
    expect(resolveTrailColor(undefined)).toBe('#c45c26');
    expect(resolveTrailColor('  ')).toBe('#c45c26');
  });
});
