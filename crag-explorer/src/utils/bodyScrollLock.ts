const SCROLL_LOCKED_CLASS = 'scroll-locked';

/** Callers that currently need the document not to scroll. */
let lockCount = 0;
/** Window offset captured by the first lock and restored by the last release. */
let lockedScrollY = 0;

function scrollbarGap(): number {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function pinPage(): void {
  lockedScrollY = window.scrollY;
  const { style } = document.body;
  // Fixed positioning pulls the body out of the document, which would jump to
  // the top. The negative top keeps the same pixels on screen.
  style.top = `-${lockedScrollY}px`;
  style.paddingRight = scrollbarGap() > 0 ? `${scrollbarGap()}px` : '';
  document.documentElement.classList.add(SCROLL_LOCKED_CLASS);
}

function unpinPage(): void {
  const { style } = document.body;
  style.top = '';
  style.paddingRight = '';
  document.documentElement.classList.remove(SCROLL_LOCKED_CLASS);
  window.scrollTo(0, lockedScrollY);
}

/**
 * Hold or release the document scroll lock. The map page and a modal can lock
 * at the same time; scrolling stays off until every holder has released.
 * An extra release is ignored so one caller cannot unlock another.
 * The first lock freezes the current scroll position; the last release puts it back.
 */
export function setBodyScrollLock(locked: boolean): void {
  const nextCount = Math.max(0, lockCount + (locked ? 1 : -1));
  const locking = lockCount === 0 && nextCount > 0;
  const unlocking = lockCount > 0 && nextCount === 0;
  lockCount = nextCount;
  if (locking) pinPage();
  if (unlocking) unpinPage();
}
