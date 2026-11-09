import React from 'react';
import { MdOutlineSettings } from 'react-icons/md';
import OptionsMenu from './OptionsMenu';
import './RoutePageOptionsMenu.scss';

interface RoutePageOptionsMenuProps {
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const RoutePageOptionsMenu: React.FC<RoutePageOptionsMenuProps> = ({
  disabled = false,
  onEdit,
  onDelete,
}) => {
  return (
    <OptionsMenu
      label="Route options"
      disabled={disabled}
      className="route-page-options-menu"
      items={[
        { label: 'Edit route details', onSelect: onEdit },
        { label: 'Delete route', onSelect: onDelete },
      ]}
      renderButton={({ open, ...buttonProps }) => (
        <button
          type="button"
          className={`route-page-options-menu__button${open ? ' is-open' : ''}`}
          {...buttonProps}
        >
          <MdOutlineSettings aria-hidden="true" />
        </button>
      )}
    />
  );
};

export default RoutePageOptionsMenu;
