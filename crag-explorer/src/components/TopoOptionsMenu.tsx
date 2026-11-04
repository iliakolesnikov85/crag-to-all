import { MdEdit } from 'react-icons/md';
import Button from './Button';
import OptionsMenu from './OptionsMenu';

interface TopoOptionsMenuProps {
  index: number;
  count: number;
  disabled?: boolean;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function TopoOptionsMenu({
  index,
  count,
  disabled = false,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TopoOptionsMenuProps) {
  const position = index + 1;
  return (
    <OptionsMenu
      label={`Topo image ${position} of ${count} options`}
      disabled={disabled}
      items={[
        { label: 'Delete topo image', onSelect: onDelete },
        {
          label: 'Move up',
          onSelect: onMoveUp,
          disabled: index <= 0,
          separatorBefore: true,
        },
        {
          label: 'Move down',
          onSelect: onMoveDown,
          disabled: index >= count - 1,
        },
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
          <MdEdit aria-hidden="true" />
        </Button>
      )}
    />
  );
}

export default TopoOptionsMenu;
