import { describe, expect, it } from 'vitest';
import { CRAG_DATA_PROTOCOL, type CragData } from '../../types';
import { escapeHtml, mapOverlayRenderKey, markerLabelFromType } from './mapOverlayHelpers';

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
    expect(escapeHtml('Main Wall')).toBe('Main Wall');
  });
});

describe('mapOverlayRenderKey', () => {
  function crag(lat: number): CragData {
    return {
      protocolVersion: CRAG_DATA_PROTOCOL,
      name: 'Test',
      description: [],
      sectors: [{
        id: 's1',
        name: 'Cave',
        version: 1,
        geo: { lat, lon: 2 },
        routes: [],
        images: [],
      }],
    };
  }

  it('changes when a sector coordinate changes and stays stable otherwise', () => {
    const before = mapOverlayRenderKey(crag(1));
    expect(mapOverlayRenderKey(crag(1))).toBe(before);
    expect(mapOverlayRenderKey(crag(1.1))).not.toBe(before);
  });
});

describe('markerLabelFromType', () => {
  it('returns a display label for each known marker type', () => {
    expect(markerLabelFromType('parking_space')).toBe('Parking');
    expect(markerLabelFromType('water_tap')).toBe('Water tap');
    expect(markerLabelFromType('camping')).toBe('Camping');
    expect(markerLabelFromType('unknown')).toBe('Map marker');
  });

  it('returns a generic label for empty or legacy types so rendering never throws', () => {
    expect(markerLabelFromType('')).toBe('Map marker');
    expect(markerLabelFromType('parking')).toBe('Map marker');
    expect(markerLabelFromType('cairn')).toBe('Map marker');
  });
});
