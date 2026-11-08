import React, { useState } from 'react';
import { pointsToBezierPath, type LinePoint } from '@crag-to-all/shared-crag';
import type { Route } from '../types';
import { confirm } from '../context/ConfirmContext';
import Button from './Button';
import Modal from './Modal';
import './DrawRouteModal.scss';

const LEAVE_CONFIRM = 'Leave this drawing? Your unsaved line will be lost.';

interface DrawRouteModalProps {
  open: boolean;
  route: Route;
  imageFile: string;
  imageUrl: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (line: LinePoint[]) => void;
}

function storedLine(route: Route, imageFile: string): LinePoint[] | undefined {
  const line = route.images.find((image) => image.imageFile === imageFile)?.line;
  if (!line || line.length < 2) return undefined;
  return line;
}

function linePointFromClient(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
): LinePoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

function DrawRouteModal({
  open,
  route,
  imageFile,
  imageUrl,
  saving,
  error,
  onClose,
  onSave,
}: DrawRouteModalProps) {
  const [points, setPoints] = useState<LinePoint[]>([]);
  const previous = storedLine(route, imageFile);
  const previousPath = previous ? pointsToBezierPath(previous) : '';
  const draftPath = pointsToBezierPath(points);
  const lastPoint = points[points.length - 1];

  const requestClose = () => {
    if (saving) return;
    if (points.length === 0) {
      onClose();
      return;
    }
    void confirm({
      title: 'Leave this drawing?',
      message: LEAVE_CONFIRM,
      confirmLabel: 'Leave',
      destructive: true,
    }).then((leave) => {
      if (leave) onClose();
    });
  };

  const addPoint = (event: React.MouseEvent<HTMLDivElement>) => {
    if (saving) return;
    const point = linePointFromClient(
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );
    if (!point) return;
    setPoints((current) => [...current, point]);
  };

  const undo = () => {
    setPoints((current) => current.slice(0, -1));
  };

  const save = () => {
    if (saving || points.length < 2) return;
    onSave(points.map((point) => ({ x: point.x, y: point.y })));
  };

  return (
    <Modal
      open={open}
      wide
      title={`Draw "${route.name}" on the topo`}
      closeOnBackdrop={false}
      onClose={requestClose}
      footer={
        <div className="draw-route-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={undo}
            disabled={saving || points.length === 0}
          >
            Undo
          </Button>
          <div className="draw-route-footer__actions">
            <Button type="button" variant="secondary" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving || points.length < 2}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      {error ? (
        <p className="draw-route-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="draw-route-stage" onClick={addPoint}>
        <img className="draw-route-image" src={imageUrl} alt="" draggable={false} />
        <svg
          className="draw-route-overlay"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {previousPath ? (
            <path className="draw-route-line draw-route-line--previous" d={previousPath} />
          ) : null}
          {draftPath ? (
            <path className="draw-route-line draw-route-line--draft" d={draftPath} />
          ) : null}
        </svg>
        {lastPoint ? (
          <span
            className="draw-route-point"
            style={{ left: `${lastPoint.x * 100}%`, top: `${lastPoint.y * 100}%` }}
          />
        ) : null}
      </div>
    </Modal>
  );
}

export default DrawRouteModal;
