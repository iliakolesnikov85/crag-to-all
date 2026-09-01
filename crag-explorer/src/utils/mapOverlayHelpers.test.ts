import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  isParkingMarkerType,
  markerLabelFromType,
  resolveTrailColor,
} from './mapOverlayHelpers';

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
    expect(escapeHtml('Main Wall')).toBe('Main Wall');
  });
});

describe('markerLabelFromType', () => {
  it('labels parking_space as Parking and empty as Map marker', () => {
    expect(markerLabelFromType('parking_space')).toBe('Parking');
    expect(markerLabelFromType('  ')).toBe('Map marker');
    expect(markerLabelFromType('water_tap')).toBe('water tap');
  });
});

describe('isParkingMarkerType', () => {
  it('treats parking_space and any parking substring as parking', () => {
    expect(isParkingMarkerType('parking_space')).toBe(true);
    expect(isParkingMarkerType('Visitor Parking')).toBe(true);
    expect(isParkingMarkerType('water_tap')).toBe(false);
  });
});

describe('resolveTrailColor', () => {
  it('accepts 3/6/8 digit hex and falls back otherwise', () => {
    expect(resolveTrailColor('#f00')).toBe('#f00');
    expect(resolveTrailColor('#ff0000')).toBe('#ff0000');
    expect(resolveTrailColor('#ff000080')).toBe('#ff000080');
    expect(resolveTrailColor('red')).toBe('#c45c26');
    expect(resolveTrailColor(undefined)).toBe('#c45c26');
    expect(resolveTrailColor('  ')).toBe('#c45c26');
  });
});
