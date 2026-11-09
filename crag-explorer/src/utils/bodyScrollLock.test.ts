import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBodyScrollLock } from './bodyScrollLock';

function releaseLocks(): void {
  for (let i = 0; i < 8; i += 1) setBodyScrollLock(false);
}

function setScrollY(scrollY: number): void {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
}

describe('setBodyScrollLock', () => {
  afterEach(() => {
    releaseLocks();
    Reflect.deleteProperty(window, 'scrollY');
    document.body.style.top = '';
    document.body.style.paddingRight = '';
  });

  it('locks while any holder still needs it', () => {
    setBodyScrollLock(true);
    setBodyScrollLock(true);
    expect(document.documentElement).toHaveClass('scroll-locked');

    setBodyScrollLock(false);
    expect(document.documentElement).toHaveClass('scroll-locked');

    setBodyScrollLock(false);
    expect(document.documentElement).not.toHaveClass('scroll-locked');
  });

  it('ignores a release when nothing is locked', () => {
    setBodyScrollLock(false);
    setBodyScrollLock(true);
    expect(document.documentElement).toHaveClass('scroll-locked');

    setBodyScrollLock(false);
    expect(document.documentElement).not.toHaveClass('scroll-locked');
  });

  it('freezes the current scroll position and restores it on release', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setScrollY(640);

    setBodyScrollLock(true);

    expect(document.body.style.top).toBe('-640px');
    expect(document.documentElement).toHaveClass('scroll-locked');
    expect(scrollTo).not.toHaveBeenCalled();

    setBodyScrollLock(false);

    expect(document.body.style.top).toBe('');
    expect(document.documentElement).not.toHaveClass('scroll-locked');
    expect(scrollTo).toHaveBeenCalledWith(0, 640);
    scrollTo.mockRestore();
  });

  it('restores scroll only when the last holder releases', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setScrollY(320);
    setBodyScrollLock(true);
    setScrollY(0);
    setBodyScrollLock(true);

    expect(document.body.style.top).toBe('-320px');

    setBodyScrollLock(false);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.body.style.top).toBe('-320px');
    expect(document.documentElement).toHaveClass('scroll-locked');

    setBodyScrollLock(false);
    expect(scrollTo).toHaveBeenCalledWith(0, 320);
    scrollTo.mockRestore();
  });

  it('keeps the scrollbar gap so content does not shift sideways', () => {
    const previousWidth = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth');
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 984,
    });

    try {
      setBodyScrollLock(true);
      expect(document.body.style.paddingRight).toBe('16px');

      setBodyScrollLock(false);
      expect(document.body.style.paddingRight).toBe('');
    } finally {
      vi.restoreAllMocks();
      if (previousWidth) {
        Object.defineProperty(document.documentElement, 'clientWidth', previousWidth);
      } else {
        Reflect.deleteProperty(document.documentElement, 'clientWidth');
      }
    }
  });
});
