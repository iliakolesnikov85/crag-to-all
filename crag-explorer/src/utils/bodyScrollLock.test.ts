import { afterEach, describe, expect, it } from 'vitest';
import { setBodyScrollLock } from './bodyScrollLock';

function releaseLocks(): void {
  for (let i = 0; i < 8; i += 1) setBodyScrollLock(false);
}

describe('setBodyScrollLock', () => {
  afterEach(releaseLocks);

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
});
