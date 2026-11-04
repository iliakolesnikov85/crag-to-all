import React, { useEffect, useRef, useState } from 'react';
import './OptionsMenu.scss';

interface OptionsMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
}

interface OptionsMenuButtonState {
  open: boolean;
  disabled: boolean;
  onClick: React.MouseEventHandler<HTMLElement>;
  'aria-label': string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
}

interface OptionsMenuProps {
  label: string;
  items: readonly OptionsMenuItem[];
  disabled?: boolean;
  className?: string;
  renderButton: (state: OptionsMenuButtonState) => React.ReactNode;
}

function OptionsMenu({
  label,
  items,
  disabled = false,
  className,
  renderButton,
}: OptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const toggle: React.MouseEventHandler<HTMLElement> = (event) => {
    event.stopPropagation();
    setOpen((current) => !current);
  };

  const rootClass = ['options-menu', open ? 'is-open' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

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
      })}
      {open ? (
        <div className="options-menu__panel" role="menu">
          {items.map((item) => (
            <div key={item.label}>
              {item.separatorBefore ? (
                <div className="options-menu__separator" role="separator" />
              ) : null}
              <button
                type="button"
                className="options-menu__item"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type { OptionsMenuItem };

export default OptionsMenu;
