import React from 'react';
import { MdOutlineSettings } from 'react-icons/md';
import OptionsMenu from './OptionsMenu';
import './SectorOptionsMenu.scss';

interface SectorOptionsMenuProps {
  disabled?: boolean;
  canDelete?: boolean;
  onEdit: () => void;
  onRoutes: () => void;
  onDelete: () => void;
}

const SectorOptionsMenu: React.FC<SectorOptionsMenuProps> = ({
  disabled = false,
  canDelete = true,
  onEdit,
  onRoutes,
  onDelete,
}) => {
  return (
    <OptionsMenu
      label="Sector options"
      disabled={disabled}
      className="sector-options-menu"
      items={[
        { label: 'Edit sector details', onSelect: onEdit },
        { label: 'Routes', onSelect: onRoutes },
        ...(canDelete ? [{ label: 'Delete sector', onSelect: onDelete }] : []),
      ]}
      renderButton={({ open, ...buttonProps }) => (
        <button
          type="button"
          className={`sector-options-menu__button${open ? ' is-open' : ''}`}
          {...buttonProps}
        >
          <MdOutlineSettings aria-hidden="true" />
        </button>
      )}
    />
  );
};

export default SectorOptionsMenu;
