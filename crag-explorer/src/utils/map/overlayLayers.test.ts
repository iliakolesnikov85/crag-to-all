import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMapMarker,
  createSectorMarkerIcon,
  createTrailLine,
  escapeHtml,
  markerLabelFromType,
  resolveTrailColor,
} from './overlayLayers';

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#039;s&lt;/a&gt;',
    );
  });
});

describe('markerLabelFromType', () => {
  it('returns a display label for each known marker type', () => {
    expect(markerLabelFromType('parking_space')).toBe('Parking');
    expect(markerLabelFromType('water_tap')).toBe('Water tap');
    expect(markerLabelFromType('camping')).toBe('Camping');
  });

  it('returns a generic label for empty or legacy types so rendering never throws', () => {
    expect(markerLabelFromType('')).toBe('Map marker');
    expect(markerLabelFromType('legacy')).toBe('Map marker');
  });
});

describe('resolveTrailColor', () => {
  it('accepts 3/6/8 digit hex and falls back otherwise', () => {
    expect(resolveTrailColor('#abc')).toBe('#abc');
    expect(resolveTrailColor('#aabbcc')).toBe('#aabbcc');
    expect(resolveTrailColor('#aabbccdd')).toBe('#aabbccdd');
    expect(resolveTrailColor('red')).toBe('#c45c26');
    expect(resolveTrailColor(undefined)).toBe('#c45c26');
  });
});

describe('layer factories', () => {
  let map: L.Map;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container).setView([42.5, 45.2], 14);
  });

  afterEach(() => {
    map.remove();
    container.remove();
  });

  it('labels the sector pin with the escaped name', () => {
    const marker = L.marker([42.5, 45.2], {
      icon: createSectorMarkerIcon({ name: 'A <b>', geo: { lat: 42.5, lon: 45.2 }, routes: [], images: [] }),
    }).addTo(map);
    expect(marker.getElement()?.querySelector('.label')?.textContent).toBe('A <b>');
    expect(marker.getElement()?.querySelector('.label b')).toBeNull();
  });

  it('gives a map marker a popup with its label and info', () => {
    const marker = createMapMarker({ type: 'parking_space', info: 'Free', geo: { lat: 1, lon: 2 } });
    expect(marker.getPopup()?.getContent()).toContain('<strong>Parking</strong>');
    expect(marker.getPopup()?.getContent()).toContain('Free');
  });

  it('draws a trail only when it has at least two points', () => {
    expect(createTrailLine({ name: 'Path', color: '#abc', points: [{ lat: 1, lon: 2 }] })).toBeNull();
    const line = createTrailLine({
      name: '',
      color: 'bad',
      points: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }],
    });
    expect(line?.options.color).toBe('#c45c26');
    expect(line?.getPopup()?.getContent()).toContain('Trail');
  });
});
