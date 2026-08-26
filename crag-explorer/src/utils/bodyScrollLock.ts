const SCROLL_LOCKED_CLASS = 'scroll-locked';

/** Lock or unlock document scrolling (e.g. map page, modal, fullscreen overlay). */
export function setBodyScrollLock(locked: boolean): void {
  document.documentElement.classList.toggle(SCROLL_LOCKED_CLASS, locked);
}
