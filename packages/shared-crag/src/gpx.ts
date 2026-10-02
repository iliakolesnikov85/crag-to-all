import type { CragMapMarker, CragMapMarkerType, CragMapTrail, Sector } from './types';

const SECTOR_WPT_TYPE = 'crag-sector';
const MAP_MARKER_WPT_TYPE_PREFIX = 'crag-map:';

function symForSector(): string {
  return 'Climbing Area';
}

function garminSymForMapMarker(type: CragMapMarkerType): string {
  switch (type) {
    case 'parking_space':
      return 'Parking Area';
    case 'water_tap':
      return 'Drinking Water';
    case 'camping':
      return 'Campground';
    default:
      return 'Information';
  }
}

function markerTitle(type: CragMapMarkerType): string {
  switch (type) {
    case 'parking_space':
      return 'Parking';
    case 'water_tap':
      return 'Water Tap';
    case 'camping':
      return 'Camping';
    default:
      return 'Map point';
  }
}

function mapMarkerWaypointName(marker: CragMapMarker, index: number): string {
  const kindLabel = markerTitle(marker.type);
  const info = marker.info.trim();
  const snippet =
    info.length > 72 ? `${info.slice(0, 69).trimEnd()}…` : info || `${kindLabel} ${index + 1}`;
  return `${kindLabel}: ${snippet}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** GPX 1.1 document with sector waypoints, map markers, and trail tracks. */
export function generateGPX(
  sectors: Sector[],
  trails: CragMapTrail[],
  markers: CragMapMarker[],
  cragName: string,
): string {
  const now = new Date().toISOString();

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Crag Explorer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(cragName)} — sectors, access, trails</name>
    <desc>Sectors, map markers (e.g. parking), and approach trails at ${escapeXml(cragName)}</desc>
    <time>${now}</time>
  </metadata>`;

  gpx += `
  <!-- Sector climbing areas (from topo sector pages) -->`;
  sectors.forEach((sector) => {
    if (!sector.geo) return;
    const { lat, lon } = sector.geo;
    gpx += `
  <wpt lat="${lat}" lon="${lon}">
    <name>${escapeXml(sector.name)}</name>
    <type>${escapeXml(SECTOR_WPT_TYPE)}</type>
    <desc>${escapeXml(sector.name)}</desc>
    <sym>${escapeXml(symForSector())}</sym>
  </wpt>`;
  });

  gpx += `
  <!-- Map markers from crag map (parking, etc.) -->`;
  markers.forEach((marker, index) => {
    const { geo: { lat, lon }, type: markerType, info } = marker;
    const wptType = `${MAP_MARKER_WPT_TYPE_PREFIX}${markerType}`;
    gpx += `
  <wpt lat="${lat}" lon="${lon}">
    <name>${escapeXml(mapMarkerWaypointName(marker, index))}</name>
    <type>${escapeXml(wptType)}</type>
    <desc>${escapeXml(info)}</desc>
    <sym>${escapeXml(garminSymForMapMarker(markerType))}</sym>
  </wpt>`;
  });

  gpx += `
  <!-- Approach / access trails (polylines from crag map) -->`;
  trails.forEach((trail) => {
    const pts = trail.points;
    if (pts.length === 0) return;
    const cmtParts = [`Trail color: ${trail.color || '(n/a)'}`];
    gpx += `
  <trk>
    <name>${escapeXml(`Trail: ${trail.name}`)}</name>
    <type>crag-trail</type>
    <cmt>${escapeXml(cmtParts.join(' · '))}</cmt>
    <trkseg>`;
    for (const p of pts) {
      gpx += `
      <trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`;
    }
    gpx += `
    </trkseg>
  </trk>`;
  });

  gpx += `
</gpx>`;

  return gpx;
}
