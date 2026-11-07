import React from 'react';
import type { Route } from '../types';
import Button from './Button';
import Modal from './Modal';
import './RouteListModal.scss';

type RouteListMode = 'routes' | 'draw';

interface RouteListModalProps {
  open: boolean;
  /** `draw` lists every sector route so lines can be added to one topo image. */
  mode?: RouteListMode;
  imageFile?: string;
  routes: readonly Route[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onDraw?: (index: number) => void;
  onRemove?: (index: number) => void;
}

interface RouteActionButtonProps {
  label: string;
  routeName: string;
  disabled: boolean;
  onClick: () => void;
}

function isOnImage(route: Route, imageFile: string): boolean {
  return route.images.some((image) => image.imageFile === imageFile);
}

function RouteActionButton({ label, routeName, disabled, onClick }: RouteActionButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      aria-label={`${label} ${routeName}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

const RouteListModal: React.FC<RouteListModalProps> = ({
  open,
  mode = 'routes',
  imageFile,
  routes,
  saving,
  error,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onDraw,
  onRemove,
}) => {
  const drawing = mode === 'draw' && Boolean(imageFile);
  return (
    <Modal
      open={open}
      title={drawing ? 'Draw lines' : 'Routes'}
      onClose={onClose}
      footer={
        <Button type="button" onClick={onAdd} disabled={saving}>
          + Add
        </Button>
      }
    >
      {error ? (
        <p className="route-list-modal__error" role="alert">
          {error}
        </p>
      ) : null}
      {routes.length === 0 ? (
        <p className="route-list-modal__empty">No routes yet.</p>
      ) : (
        <ul className="route-list-modal__list">
          {routes.map((route, index) => {
            const onImage = drawing && imageFile ? isOnImage(route, imageFile) : false;
            return (
              <li key={route.id} className="route-list-modal__row">
                <span className="route-list-modal__name">
                  {route.name}
                  {route.grade ? `, ${route.grade}` : ''}
                </span>
                <div className="route-list-modal__actions">
                  {drawing ? (
                    <RouteActionButton
                      label={onImage ? 'Redraw' : 'Draw'}
                      routeName={route.name}
                      disabled={saving}
                      onClick={() => onDraw?.(index)}
                    />
                  ) : null}
                  <RouteActionButton
                    label="Edit"
                    routeName={route.name}
                    disabled={saving}
                    onClick={() => onEdit(index)}
                  />
                  {drawing && onImage ? (
                    <RouteActionButton
                      label="Remove"
                      routeName={route.name}
                      disabled={saving}
                      onClick={() => onRemove?.(index)}
                    />
                  ) : null}
                  {drawing ? null : (
                    <RouteActionButton
                      label="Delete"
                      routeName={route.name}
                      disabled={saving}
                      onClick={() => onDelete(index)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};

export default RouteListModal;
