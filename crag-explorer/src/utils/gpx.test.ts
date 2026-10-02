import { describe, expect, it } from 'vitest';
import { generateGPX, type CragMapMarker, type CragMapTrail, type Sector } from '@crag-to-all/shared-crag';

const sector = (name: string, geo: Sector['geo']): Sector => ({
  name,
  geo,
  routes: [],
  images: [],
});

describe('generateGPX', () => {
  it('emits sector waypoints, map markers, and trail tracks', () => {
    const trails: CragMapTrail[] = [
      {
        name: 'Approach',
        color: '#00f',
        points: [
          { lat: 44.1, lon: 6.2 },
          { lat: 44.11, lon: 6.21 },
        ],
      },
    ];
    const markers: CragMapMarker[] = [
      { type: 'parking_space', info: 'Lot A', geo: { lat: 44.0, lon: 6.0 } },
    ];
    const gpx = generateGPX(
      [sector('Cave', { lat: 44.1, lon: 6.2 })],
      trails,
      markers,
      'Test Crag',
    );

    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1" creator="Crag Explorer"');
    expect(gpx).toContain('<name>Test Crag — sectors, access, trails</name>');
    expect(gpx).toMatch(/<time>\d{4}-\d{2}-\d{2}T/);
    expect(gpx).toContain('<wpt lat="44.1" lon="6.2">');
    expect(gpx).toContain('<name>Cave</name>');
    expect(gpx).toContain('<type>crag-sector</type>');
    expect(gpx).toContain('<sym>Climbing Area</sym>');
    expect(gpx).toContain('<type>crag-map:parking_space</type>');
    expect(gpx).toContain('<name>Parking: Lot A</name>');
    expect(gpx).toContain('<sym>Parking Area</sym>');
    expect(gpx).toContain('<name>Trail: Approach</name>');
    expect(gpx).toContain('<type>crag-trail</type>');
    expect(gpx).toContain('<trkpt lat="44.1" lon="6.2"></trkpt>');
    expect(gpx).toContain('<trkpt lat="44.11" lon="6.21"></trkpt>');
  });

  it('escapes XML special characters in names', () => {
    const gpx = generateGPX(
      [sector('A & B <C>', { lat: 1, lon: 2 })],
      [],
      [],
      'Foo & Bar',
    );

    expect(gpx).toContain('Foo &amp; Bar');
    expect(gpx).toContain('A &amp; B &lt;C&gt;');
    expect(gpx).not.toContain('A & B <C>');
  });

  it('skips sectors without geo and trails without points', () => {
    const gpx = generateGPX(
      [sector('NoGeo', null)],
      [{ name: 'Empty', color: '#f00', points: [] }],
      [],
      'X',
    );

    expect(gpx).not.toContain('NoGeo');
    expect(gpx).not.toContain('<trk>');
    expect(gpx).not.toContain('Empty');
  });
});
