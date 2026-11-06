import type { LinePoint } from './types';

/** Catmull-Rom spline through the points, converted to cubic Bézier SVG path. */
export function pointsToBezierPath(points: LinePoint[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    parts.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`);
  }

  return parts.join(' ');
}

/** Point with the greatest y. Image fractions grow downward, so this is the lowest point. */
export function lowestLinePoint(points: LinePoint[]): LinePoint | undefined {
  if (points.length === 0) return undefined;
  return points.reduce((lowest, point) => (point.y > lowest.y ? point : lowest));
}
