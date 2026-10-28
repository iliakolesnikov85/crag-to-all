import type { CragData, Sector } from '../../types';

function sectorOverlayKey(sector: Sector): string {
  const geo = sector.geo ? `${sector.geo.lat},${sector.geo.lon}` : '';
  const routes = sector.routes.map((route) => `${route.name}:${route.grade}`).join(',');
  const images = sector.images.map((image) => image.imageFile).join(',');
  return [sector.id ?? '', sector.name, geo, String(sector.version ?? ''), routes, images].join('~');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function markerLabelFromType(type: string): string {
  switch (type) {
    case 'parking_space':
      return 'Parking';
    case 'water_tap':
      return 'Water tap';
    case 'camping':
      return 'Camping';
    default:
      return 'Map marker';
  }
}

/** Identity of the overlay contents. Unchanged keys can keep the current Leaflet layers. */
export function mapOverlayRenderKey(cragData: CragData): string {
  const sectors = cragData.sectors.map(sectorOverlayKey).join(';');
  const markers = (cragData.markers ?? [])
    .map((marker) => `${marker.type}:${marker.geo.lat},${marker.geo.lon}:${marker.info}`)
    .join(';');
  const trails = (cragData.trails ?? [])
    .map((trail) => {
      const points = trail.points.map((point) => `${point.lat},${point.lon}`).join(',');
      return `${trail.name}:${trail.color}:${points}`;
    })
    .join(';');
  return `${sectors}|${markers}|${trails}`;
}
