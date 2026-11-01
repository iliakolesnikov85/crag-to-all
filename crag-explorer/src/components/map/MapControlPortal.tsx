import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as L from 'leaflet';

interface MapControlPortalProps {
  map: L.Map | null;
  position?: L.ControlPosition;
  className?: string;
  children: React.ReactNode;
}

/** Render React children inside a Leaflet control corner, so they stack with the zoom control. */
const MapControlPortal: React.FC<MapControlPortalProps> = ({
  map,
  position = 'topleft',
  className = '',
  children,
}) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!map) return;
    const Control = L.Control.extend({
      onAdd() {
        const element = L.DomUtil.create('div', `leaflet-bar leaflet-control ${className}`.trim());
        // Clicks on the controls must not drag or click the map underneath.
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);
        return element;
      },
    });
    const control = new Control({ position }).addTo(map);
    setContainer(control.getContainer() ?? null);
    return () => {
      setContainer(null);
      control.remove();
    };
  }, [map, position, className]);

  return container ? createPortal(children, container) : null;
};

export default MapControlPortal;
