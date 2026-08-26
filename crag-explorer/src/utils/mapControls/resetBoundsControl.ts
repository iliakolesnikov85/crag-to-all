// Custom Reset Bounds Control for Leaflet
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as L from 'leaflet';
import { MdHome } from 'react-icons/md';
import { CragData } from '../../types';
import { fitMapToCragBounds } from '../mapSetup';
import { createControlButton } from './createControlButton';

const resetBoundsIconHtml = renderToStaticMarkup(
  createElement(MdHome, { size: 18 })
);

export const createResetBoundsControl = (cragData: CragData) => {
  return L.Control.extend({
    options: {
      position: 'topleft'
    },

    onAdd: function(map: L.Map) {
      const { container } = createControlButton({
        className: 'leaflet-control-reset-bounds',
        title: 'Reset to crag bounds',
        html: resetBoundsIconHtml,
        onClick: () => fitMapToCragBounds(map, cragData),
      });

      return container;
    }
  });
};
