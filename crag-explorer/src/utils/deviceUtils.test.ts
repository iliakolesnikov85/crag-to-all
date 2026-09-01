import { describe, expect, it, vi } from 'vitest';
import { isAndroidDevice, isIosDevice } from './deviceUtils';

function stubUserAgent(userAgent: string): void {
  vi.stubGlobal('navigator', { userAgent });
}

describe('isIosDevice', () => {
  it('detects iPhone, iPad, and iPod', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(isIosDevice()).toBe(true);
    stubUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)');
    expect(isIosDevice()).toBe(true);
    stubUserAgent('Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X)');
    expect(isIosDevice()).toBe(true);
  });

  it('returns false for non-iOS agents', () => {
    stubUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36');
    expect(isIosDevice()).toBe(false);
  });

  it('returns false when navigator is missing', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isIosDevice()).toBe(false);
  });
});

describe('isAndroidDevice', () => {
  it('detects Android case-insensitively', () => {
    stubUserAgent('Mozilla/5.0 (Linux; android 14) AppleWebKit/537.36');
    expect(isAndroidDevice()).toBe(true);
  });

  it('returns false for non-Android agents', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(isAndroidDevice()).toBe(false);
  });

  it('returns false when navigator is missing', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isAndroidDevice()).toBe(false);
  });
});
