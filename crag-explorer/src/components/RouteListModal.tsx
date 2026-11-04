import React from 'react';
import { MdDelete, MdEdit } from 'react-icons/md';
import type { Route } from '../types';
import Button from './Button';
import Modal from './Modal';
import './RouteListModal.scss';

interface RouteListModalProps {
  open: boolean;
  routes: readonly Route[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

const RouteListModal: React.FC<RouteListModalProps> = ({
  open,
  routes,
  saving,
  error,
  onClose,
  onAdd,
  onEdit,
  onDelete,
}) => {
  return (
    <Modal
      open={open}
      title="Routes"
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
          {routes.map((route, index) => (
            <li key={route.id ?? `${route.name}-${index}`} className="route-list-modal__row">
              <span className="route-list-modal__name">
                {route.name}
                {route.grade ? `, ${route.grade}` : ''}
              </span>
              <Button
                type="button"
                iconOnly
                size="sm"
                variant="ghost"
                aria-label={`Edit ${route.name}`}
                disabled={saving}
                onClick={() => onEdit(index)}
              >
                <MdEdit />
              </Button>
              <Button
                type="button"
                iconOnly
                size="sm"
                variant="ghost"
                aria-label={`Delete ${route.name}`}
                disabled={saving}
                onClick={() => onDelete(index)}
              >
                <MdDelete />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

export default RouteListModal;
