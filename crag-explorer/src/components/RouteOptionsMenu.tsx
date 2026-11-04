import React from 'react';
import { MdOutlineSettings } from 'react-icons/md';
import Button from './Button';
import OptionsMenu from './OptionsMenu';

interface RouteOptionsMenuProps {
  routeName: string;
  disabled?: boolean;
  onEditDetails: () => void;
}

function RouteOptionsMenu({
  routeName,
  disabled = false,
  onEditDetails,
}: RouteOptionsMenuProps) {
  return (
    <OptionsMenu
      label={`Options for ${routeName}`}
      disabled={disabled}
      items={[{ label: 'Edit route details', onSelect: onEditDetails }]}
      renderButton={({ open, ...buttonProps }) => (
        <Button
          type="button"
          iconOnly
          size="sm"
          variant="ghost"
          active={open}
          {...buttonProps}
        >
          <MdOutlineSettings aria-hidden="true" />
        </Button>
      )}
    />
  );
}

export default RouteOptionsMenu;
