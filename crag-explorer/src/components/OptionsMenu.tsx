import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './OptionsMenu.scss';

interface OptionsMenuItem {
  label: string;
  onSelect: () => void;
  separatorBefore?: boolean;
}

interface OptionsMenuButtonState {
  open: boolean;
  disabled: boolean;
  onClick: React.MouseEventHandler<HTMLElement>;
  'aria-label': string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls'?: string;
}

interface OptionsMenuProps {
  label: string;
  items: readonly OptionsMenuItem[];
  disabled?: boolean;
  className?: string;
  /** Draw the menu on the document so a scrolling or clipped parent cannot cut it off. */
  overlay?: boolean;
  renderButton: (state: OptionsMenuButtonState) => React.ReactNode;
}

function menuItemButtons(panel: HTMLElement | null): HTMLButtonElement[] {
  if (!panel) return [];
  return [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
}

function focusMenuButton(root: HTMLElement | null) {
  root?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
}

function placeOverlayPanel(anchor: HTMLElement, panel: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const height = panel.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const openUp = height > 0 && spaceBelow < height && rect.top > spaceBelow;
  const top = openUp ? rect.top - gap - height : rect.bottom + gap;
  panel.style.top = `${Math.max(8, top)}px`;
  panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
}

function OptionsMenu({
  label,
  items,
  disabled = false,
  className,
  overlay = false,
  renderButton,
}: OptionsMenuProps) {
  const menuId = useId().replace(/:/g, '');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeToButton = () => {
    setOpen(false);
    focusMenuButton(rootRef.current);
  };

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open || !overlay) return;
    const place = () => {
      const anchor = rootRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      placeOverlayPanel(anchor, panel);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, overlay]);

  useLayoutEffect(() => {
    if (!open) return;
    menuItemButtons(panelRef.current)[0]?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeToButton();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      closeToButton();
      return;
    }
    const items = menuItemButtons(panelRef.current);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
    else if (event.key === 'ArrowUp') next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next < 0) return;
    event.preventDefault();
    items[next].focus({ preventScroll: true });
  };

  const toggle: React.MouseEventHandler<HTMLElement> = (event) => {
    event.stopPropagation();
    setOpen((current) => !current);
  };

  const rootClass = ['options-menu', open ? 'is-open' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  const panel = open ? (
    <div
      id={menuId}
      className={overlay ? 'options-menu__panel options-menu__panel--overlay' : 'options-menu__panel'}
      role="menu"
      ref={panelRef}
      onKeyDown={handlePanelKeyDown}
    >
      {items.map((item) => (
        <div key={item.label}>
          {item.separatorBefore ? (
            <div className="options-menu__separator" role="separator" />
          ) : null}
          <button
            type="button"
            className="options-menu__item"
            role="menuitem"
            onClick={() => {
              closeToButton();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div
      className={rootClass}
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
    >
      {renderButton({
        open,
        disabled,
        onClick: toggle,
        'aria-label': label,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
      })}
      {overlay && panel ? createPortal(panel, document.body) : panel}
    </div>
  );
}

export type { OptionsMenuItem };

export default OptionsMenu;
