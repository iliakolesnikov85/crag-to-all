import { describe, expect, it, vi } from 'vitest';
import {
  SAMPLE_CRAG_ID,
  SAMPLE_IMAGE_FILE,
  sampleCragData,
} from '../../test/fixtures/cragData';
import {
  getCragDataUrl,
  getCragImageUrl,
  getCragSectorsGpxUrl,
} from '../firebaseStorage';
import {
  collectCragImageFiles,
  collectCragOfflineUrls,
  extractImageFileFromUrl,
  getOfflineCacheName,
  isOptionalOfflineUrl,
} from './offlineAssets';

describe('collectCragImageFiles', () => {
  it('returns unique image filenames from sectors and routes', () => {
    expect(collectCragImageFiles(sampleCragData)).toEqual([SAMPLE_IMAGE_FILE]);
  });
});

describe('collectCragOfflineUrls', () => {
  it('includes JSON, optional GPX, and image URLs', () => {
    const urls = collectCragOfflineUrls(SAMPLE_CRAG_ID, sampleCragData);
    expect(urls).toEqual([
      getCragDataUrl(SAMPLE_CRAG_ID),
      getCragSectorsGpxUrl(SAMPLE_CRAG_ID),
      getCragImageUrl(SAMPLE_CRAG_ID, SAMPLE_IMAGE_FILE),
    ]);
  });
});

describe('getOfflineCacheName', () => {
  it('prefixes the crag id', () => {
    expect(getOfflineCacheName('roshka')).toBe('crag-offline-roshka');
  });
});

describe('isOptionalOfflineUrl', () => {
  it('treats the sectors GPX as optional', () => {
    expect(isOptionalOfflineUrl(getCragSectorsGpxUrl(SAMPLE_CRAG_ID))).toBe(true);
    expect(isOptionalOfflineUrl(getCragDataUrl(SAMPLE_CRAG_ID))).toBe(false);
    expect(
      isOptionalOfflineUrl(getCragImageUrl(SAMPLE_CRAG_ID, SAMPLE_IMAGE_FILE)),
    ).toBe(false);
  });
});

describe('extractImageFileFromUrl', () => {
  it('decodes hashed filenames from encoded Firebase image URLs', () => {
    expect(
      extractImageFileFromUrl(getCragImageUrl(SAMPLE_CRAG_ID, SAMPLE_IMAGE_FILE)),
    ).toBe(SAMPLE_IMAGE_FILE);
    expect(
      extractImageFileFromUrl(getCragImageUrl(SAMPLE_CRAG_ID, 'a b.jpg')),
    ).toBe('a b.jpg');
  });

  it('parses unencoded /images/ paths and ignores unrelated URLs', () => {
    expect(
      extractImageFileFromUrl('https://example.com/images/wall.jpg?alt=media'),
    ).toBe('wall.jpg');
    expect(extractImageFileFromUrl(getCragDataUrl(SAMPLE_CRAG_ID))).toBeNull();
  });

  it('returns null when the encoded filename cannot be decoded', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(extractImageFileFromUrl('https://example.com/images%2F%')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
