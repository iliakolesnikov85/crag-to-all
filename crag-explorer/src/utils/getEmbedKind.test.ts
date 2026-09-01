import { describe, expect, it } from 'vitest';
import { getEmbedKind } from './getEmbedKind';

describe('getEmbedKind', () => {
  it('detects Instagram URLs case-insensitively', () => {
    expect(getEmbedKind('https://www.Instagram.com/p/abc/embed')).toBe(
      'instagram',
    );
  });

  it('detects YouTube URLs case-insensitively', () => {
    expect(getEmbedKind('https://www.YouTube.com/embed/abc')).toBe('youtube');
  });

  it('falls back to default for other hosts', () => {
    expect(getEmbedKind('https://vimeo.com/123')).toBe('default');
  });
});
