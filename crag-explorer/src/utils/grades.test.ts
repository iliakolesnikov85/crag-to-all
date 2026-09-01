import { describe, expect, it } from 'vitest';
import { sampleCragData } from '../test/fixtures/cragData';
import {
  createPieChartSVG,
  getBaseGrade,
  getGradeColor,
  getGradeCounts,
  getSectorGradeCounts,
} from './grades';

describe('getBaseGrade', () => {
  it('strips plus and minus suffixes', () => {
    expect(getBaseGrade('6A+')).toBe('6A');
    expect(getBaseGrade('6A-')).toBe('6A');
  });

  it('uppercases letter grades', () => {
    expect(getBaseGrade('6c+')).toBe('6C');
  });

  it('passes through unknown grades', () => {
    expect(getBaseGrade('?')).toBe('?');
    expect(getBaseGrade('v4')).toBe('V4');
  });
});

describe('getGradeCounts', () => {
  it('skips empty grades', () => {
    expect(
      getGradeCounts([
        { grade: '6A' },
        { grade: '' },
        { grade: '   ' },
      ]),
    ).toEqual([{ grade: '6A', count: 1 }]);
  });

  it('sorts ? last and merges plus variants', () => {
    expect(
      getGradeCounts([
        { grade: '?' },
        { grade: '6A+' },
        { grade: '7A' },
        { grade: '6A' },
      ]),
    ).toEqual([
      { grade: '6A', count: 2 },
      { grade: '7A', count: 1 },
      { grade: '?', count: 1 },
    ]);
  });

  it('counts fixture routes', () => {
    expect(getGradeCounts(sampleCragData.sectors[0].routes)).toEqual([
      { grade: '6A', count: 1 },
      { grade: '?', count: 1 },
    ]);
  });
});

describe('getSectorGradeCounts', () => {
  it('returns base-grade counts for a sector', () => {
    expect(getSectorGradeCounts(sampleCragData.sectors[0])).toEqual({
      '6A': 1,
      '?': 1,
    });
  });

  it('returns an empty object for a sector with no routes', () => {
    expect(getSectorGradeCounts(sampleCragData.sectors[1])).toEqual({});
  });
});

describe('createPieChartSVG', () => {
  it('renders a gray circle when there are no grades', () => {
    const svg = createPieChartSVG({});
    expect(svg).toContain('fill="#888"');
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<path');
  });

  it('renders a single filled circle for one grade', () => {
    const svg = createPieChartSVG({ '6A': 3 });
    expect(svg).toContain(`fill="${getGradeColor('6A')}"`);
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<path');
  });

  it('renders path slices for multiple grades', () => {
    const svg = createPieChartSVG({ '6A': 1, '6B': 1 });
    expect(svg).toContain('<path');
    expect(svg).toContain(`fill="${getGradeColor('6A')}"`);
    expect(svg).toContain(`fill="${getGradeColor('6B')}"`);
  });

  it('uses the requested size', () => {
    const svg = createPieChartSVG({ '6A': 1 }, 24);
    expect(svg).toContain('width="24"');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });
});
