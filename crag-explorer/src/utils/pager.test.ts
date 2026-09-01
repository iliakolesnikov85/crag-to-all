import { describe, expect, it } from 'vitest';
import { buildPagerItems } from './pager';

describe('buildPagerItems', () => {
  it('lists every page when there are 7 or fewer', () => {
    expect(buildPagerItems(1, 1)).toEqual([1]);
    expect(buildPagerItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the first six pages when current is near the start', () => {
    expect(buildPagerItems(1, 10)).toEqual([1, 2, 3, 4, 5, 6, 'ellipsis', 10]);
    expect(buildPagerItems(4, 10)).toEqual([1, 2, 3, 4, 5, 6, 'ellipsis', 10]);
  });

  it('keeps the last six pages when current is near the end', () => {
    expect(buildPagerItems(7, 10)).toEqual([1, 'ellipsis', 5, 6, 7, 8, 9, 10]);
    expect(buildPagerItems(10, 10)).toEqual([1, 'ellipsis', 5, 6, 7, 8, 9, 10]);
  });

  it('shows a window around the current page in the middle', () => {
    expect(buildPagerItems(5, 10)).toEqual([
      1,
      'ellipsis',
      4,
      5,
      6,
      'ellipsis',
      10,
    ]);
    expect(buildPagerItems(6, 10)).toEqual([
      1,
      'ellipsis',
      5,
      6,
      7,
      'ellipsis',
      10,
    ]);
  });
});
