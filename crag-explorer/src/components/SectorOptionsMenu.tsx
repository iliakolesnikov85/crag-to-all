import React, { useEffect, useRef, useState } from 'react';
import { MdOutlineSettings } from 'react-icons/md';
import './SectorOptionsMenu.scss';

interface SectorOptionsMenuProps {
  disabled?: boolean;
  onDelete: () => void;
}

const SectorOptionsMenu: React.FC<SectorOptionsMenuProps> = ({ disabled = false, onDelete }) => {
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

  return (
    <div className="sector-options-menu" ref={rootRef}>
      <button
        type="button"
        className={`sector-options-menu__button${open ? ' is-open' : ''}`}
        aria-label="Sector options"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <MdOutlineSettings aria-hidden="true" />
      </button>
      {open ? (
        <div className="sector-options-menu__panel" role="menu">
          <button
            type="button"
            className="sector-options-menu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete sector
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default SectorOptionsMenu;
