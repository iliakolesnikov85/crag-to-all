import { MdMoreVert } from 'react-icons/md';
import Button from './Button';
import OptionsMenu from './OptionsMenu';

interface RoutesPageListOptionsMenuProps {
  label: string;
  disabled?: boolean;
  onEditRoute?: () => void;
  onEditSector: () => void;
}

function RoutesPageListOptionsMenu({
  label,
  disabled = false,
  onEditRoute,
  onEditSector,
}: RoutesPageListOptionsMenuProps) {
  return (
    <OptionsMenu
      label={label}
      disabled={disabled}
      overlay
      items={[
        ...(onEditRoute ? [{ label: 'Edit route details', onSelect: onEditRoute }] : []),
        { label: 'Edit sector details', onSelect: onEditSector },
      ]}
      renderButton={({ open, ...buttonProps }) => (
        <Button
          type="button"
          iconOnly
          size="sm"
          variant="ghost"
          active={open}
          {...buttonProps}
        >
          <MdMoreVert aria-hidden="true" />
        </Button>
      )}
    />
  );
}

export default RoutesPageListOptionsMenu;
