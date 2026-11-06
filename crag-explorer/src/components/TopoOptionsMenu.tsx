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
  const moveItems = [
    index > 0 ? { label: 'Move image up', onSelect: onMoveUp } : null,
    index < count - 1 ? { label: 'Move image down', onSelect: onMoveDown } : null,
  ].filter((item) => item !== null);
  return (
    <OptionsMenu
      label={`Topo image ${position} of ${count} options`}
      disabled={disabled}
      items={[
        { label: 'Delete topo image', onSelect: onDelete },
        ...moveItems.map((item, itemIndex) =>
          itemIndex === 0 ? { ...item, separatorBefore: true } : item,
        ),
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
