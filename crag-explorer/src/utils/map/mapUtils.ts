const DEFAULT_TRAIL_COLOR = '#c45c26';
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function resolveTrailColor(rawColor: string | undefined): string {
  const raw = (rawColor || '').trim();
  return HEX_COLOR.test(raw) ? raw : DEFAULT_TRAIL_COLOR;
}
