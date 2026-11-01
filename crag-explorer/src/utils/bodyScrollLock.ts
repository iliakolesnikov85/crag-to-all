const SCROLL_LOCKED_CLASS = 'scroll-locked';

/** Callers that currently need the document not to scroll. */
let lockCount = 0;

/**
 * Hold or release the document scroll lock. The map page and a modal can lock
 * at the same time; scrolling stays off until every holder has released.
 * An extra release is ignored so one caller cannot unlock another.
 */
export function setBodyScrollLock(locked: boolean): void {
  lockCount = Math.max(0, lockCount + (locked ? 1 : -1));
  document.documentElement.classList.toggle(SCROLL_LOCKED_CLASS, lockCount > 0);
}
