import { describe, expect, it } from 'vitest';
import { escapeHtml, markerLabelFromType } from './mapOverlayHelpers';

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
    expect(escapeHtml('Main Wall')).toBe('Main Wall');
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
