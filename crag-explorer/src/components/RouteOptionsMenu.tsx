import React from 'react';
import { MdOutlineSettings } from 'react-icons/md';
import Button from './Button';
import OptionsMenu from './OptionsMenu';

interface RouteOptionsMenuProps {
  routeName: string;
  index: number;
  count: number;
  disabled?: boolean;
  onEditDetails: () => void;
  onRedraw?: () => void;
  onRemoveFromTopo?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function RouteOptionsMenu({
  routeName,
  index,
  count,
  disabled = false,
  onEditDetails,
  onRedraw,
  onRemoveFromTopo,
  onMoveUp,
  onMoveDown,
}: RouteOptionsMenuProps) {
  const moveItems = onMoveUp && onMoveDown
    ? [
      index > 0 ? { label: 'Move route up', onSelect: onMoveUp } : null,
      index < count - 1 ? { label: 'Move route down', onSelect: onMoveDown } : null,
    ].filter((item) => item !== null)
    : [];
  return (
    <OptionsMenu
      label={`Options for ${routeName}`}
      disabled={disabled}
      items={[
        { label: 'Edit route details', onSelect: onEditDetails },
        ...(onRedraw ? [{ label: 'Redraw route', onSelect: onRedraw }] : []),
        ...(onRemoveFromTopo
          ? [{ label: 'Remove from topo image', onSelect: onRemoveFromTopo, separatorBefore: true }]
          : []),
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
          <MdOutlineSettings aria-hidden="true" />
        </Button>
      )}
    />
  );
}

export default RouteOptionsMenu;
