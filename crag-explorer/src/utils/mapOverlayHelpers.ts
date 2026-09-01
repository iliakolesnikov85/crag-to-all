export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function markerLabelFromType(type: string): string {
  const t = type.trim().toLowerCase();
  if (t === 'parking_space') return 'Parking';
  if (!t) return 'Map marker';
  return type.replace(/_/g, ' ');
}

export function isParkingMarkerType(type: string): boolean {
  const t = type.trim().toLowerCase();
  return t === 'parking_space' || t.includes('parking');
}

export function resolveTrailColor(rawColor: string | undefined): string {
  const raw = (rawColor || '').trim();
  if (
    /^#[0-9a-fA-F]{3}$/.test(raw) ||
    /^#[0-9a-fA-F]{6}$/.test(raw) ||
    /^#[0-9a-fA-F]{8}$/.test(raw)
  ) {
    return raw;
  }
  return '#c45c26';
}
