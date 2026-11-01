import React, { useLayoutEffect, useRef } from 'react';
import { MdClose } from 'react-icons/md';
import * as L from 'leaflet';
import type { LatLng } from '../../types';
import Button from '../Button';

const VIEW_PADDING_PX = 12;

interface MapAnchoredCardProps {
  map: L.Map;
  geo: LatLng;
  /** Keep the card mounted but out of sight, e.g. while its pin is dragged. */
  hidden?: boolean;
  onClose(): void;
  children: React.ReactNode;
}

/** Pan the map so the card is fully visible. Computed from real screen boxes. */
function panCardIntoView(map: L.Map, card: HTMLElement): void {
  const frame = map.getContainer().getBoundingClientRect();
  const box = card.getBoundingClientRect();
  if (frame.width < 1 || frame.height < 1 || box.width < 1 || box.height < 1) return;
  const pad = VIEW_PADDING_PX;
  let dx = 0;
  let dy = 0;
  if (box.right > frame.right - pad) dx = box.right - (frame.right - pad);
  if (box.left < frame.left + pad) dx = box.left - (frame.left + pad);
  if (box.bottom > frame.bottom - pad) dy = box.bottom - (frame.bottom - pad);
  if (box.top < frame.top + pad) dy = box.top - (frame.top + pad);
  if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { animate: false });
}

/** Card pinned above a map location. Follows the point on pan and zoom. */
const MapAnchoredCard: React.FC<MapAnchoredCardProps> = ({ map, geo, hidden = false, onClose, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const point = map.latLngToContainerPoint([geo.lat, geo.lon]);
      element.style.setProperty('--anchor-x', `${point.x}px`);
      element.style.setProperty('--anchor-y', `${point.y}px`);
    };
    update();
    map.on('move zoom viewreset resize', update);
    return () => {
      map.off('move zoom viewreset resize', update);
    };
  }, [map, geo.lat, geo.lon]);

  // Bring the card into view when it appears and whenever its size changes
  // (e.g. entering edit mode).
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || hidden) return;
    panCardIntoView(map, element);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => panCardIntoView(map, element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [map, hidden]);

  return (
    <div
      ref={ref}
      className={`sector-map-card${hidden ? ' sector-map-card--hidden' : ''}`}
      role="dialog"
      aria-label="Sector details"
    >
      <Button
        type="button"
        iconOnly
        size="sm"
        variant="ghost"
        className="sector-map-card__close"
        aria-label="Close"
        onClick={onClose}
      >
        <MdClose />
      </Button>
      {children}
    </div>
  );
};

export default MapAnchoredCard;
