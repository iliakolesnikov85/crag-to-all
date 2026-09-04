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
