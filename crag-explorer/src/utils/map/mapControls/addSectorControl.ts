// Add Sector Control for Leaflet: a toggle button with a pie-chart icon.
import * as L from 'leaflet';
import { createPieChartSVG } from '../../grades';
import { createControlButton } from './createControlButton';

const ACTIVE_CLASS = 'leaflet-control-add-sector--active';

const addSectorIconHtml = `
  <span class="add-sector-icon" aria-hidden="true">
    ${createPieChartSVG({ '6A': 1, '6B': 1, '6C': 1, '7A': 1 }, 20)}
    <svg class="add-sector-icon__plus" width="11" height="11" viewBox="0 0 11 11" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <circle cx="5.5" cy="5.5" r="5" fill="#1565c0" stroke="#fff" stroke-width="1"/>
      <path d="M5.5 3v5M3 5.5h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </span>
`;

type AddSectorControlInstance = AddSectorControl & {
  _button?: HTMLAnchorElement | null;
};

export type AddSectorControl = L.Control & {
  setActive(active: boolean): void;
};

export const createAddSectorControl = (onClick: () => void) => {
  return L.Control.extend({
    options: {
      position: 'topleft'
    },

    onAdd: function(this: AddSectorControlInstance) {
      const { container, button } = createControlButton({
        className: 'leaflet-control-add-sector',
        html: addSectorIconHtml,
        onClick,
      });
      button.setAttribute('role', 'button');
      this._button = button;
      this.setActive(false);
      return container;
    },

    onRemove: function(this: AddSectorControlInstance) {
      this._button = null;
    },

    setActive: function(this: AddSectorControlInstance, active: boolean) {
      const button = this._button;
      if (!button) return;
      button.classList.toggle(ACTIVE_CLASS, active);
      button.setAttribute('aria-pressed', String(active));
      button.title = active ? 'Cancel adding sector' : 'Add sector';
    }
  }) as new () => AddSectorControl;
};
