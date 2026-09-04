import * as L from 'leaflet';

type ControlButtonOptions = {
  className: string;
  title?: string;
  html?: string;
  onClick: () => void;
};

/** Shared Leaflet control bar + button with click wiring. */
export function createControlButton(
  { className, title = '', html, onClick }: ControlButtonOptions
): { container: HTMLElement; button: HTMLAnchorElement } {
  const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
  const button = L.DomUtil.create('a', className, container) as HTMLAnchorElement;

  button.href = '#';
  button.title = title;
  if (html !== undefined) {
    button.innerHTML = html;
  }

  L.DomEvent.on(button, 'click', L.DomEvent.stopPropagation)
    .on(button, 'click', L.DomEvent.preventDefault)
    .on(button, 'click', onClick);

  return { container, button };
}
