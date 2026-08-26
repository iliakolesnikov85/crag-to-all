import { Sector } from '../types';

// Helper to get base grade (e.g., '6A' from '6A+', '6A-')
export function getBaseGrade(grade: string): string {
  const match = grade.match(/^([0-9]+[A-Ca-c])/);
  return match ? match[1].toUpperCase() : grade.toUpperCase();
}

// Helper to assign colors to grades
export function getGradeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case '6A': return '#FFD600'; // yellow
    case '6B': return '#43A047'; // green
    case '6C': return '#1E88E5'; // blue
    case '7A': return '#E53935'; // red
    case '7B': return '#222';    // black
    case '7C': return 'rgb(230, 153, 189)';
    default:
      if (parseInt(grade[0]) <= 5) {
        return '#FFFFFF';
      }
      if (grade[0] === '?') {
        return '#d3d3d3';
      }
      // Generate a random pastel color based on grade string
      let hash = 0;
      for (let i = 0; i < grade.length; i++) hash = grade.charCodeAt(i) + ((hash << 5) - hash);
      const h = Math.abs(hash) % 360;
      return `hsl(${h}, 60%, 75%)`;
  }
}

// Helper to count grades in a list of routes and return sorted array
export function getGradeCounts(routes: Array<{ grade: string }>): { grade: string; count: number }[] {
  const gradeCounts: Record<string, number> = {};
  routes.forEach(route => {
    let base = getBaseGrade(route.grade);
    if (!base || base.trim() === '') return;
    gradeCounts[base] = (gradeCounts[base] || 0) + 1;
  });
  // Sort grades: known grades alphabetically, Unknown last
  return Object.entries(gradeCounts)
    .sort(([a], [b]) => {
      if (a === '?') return 1;
      if (b === '?') return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    })
    .map(([grade, count]) => ({ grade, count }));
}

export function getSectorGradeCounts(sector: Sector): Record<string, number> {
  const gradeCounts: Record<string, number> = {};
  sector.routes.forEach((route) => {
    const base = getBaseGrade(route.grade);
    gradeCounts[base] = (gradeCounts[base] ?? 0) + 1;
  });
  return gradeCounts;
}

// Used by Leaflet map markers and sector cards in the overview page.
export function createPieChartSVG(gradeCounts: Record<string, number>, size = 40): string {
  const grades = Object.keys(gradeCounts);
  const total = grades.reduce((sum, g) => sum + (gradeCounts[g] || 0), 0);
  let fillColor: string | null = null;
  if (total === 0) {
    fillColor = '#888';
  } else if (grades.length === 1) {
    fillColor = getGradeColor(grades[0]);
  }
  if (fillColor) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${fillColor}" stroke="#222" stroke-width="2" />
    </svg>`;
  }
  let angle = 0;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  let paths = '';
  grades.forEach((grade) => {
    const count = gradeCounts[grade] || 0;
    if (count === 0) return;
    const startAngle = angle;
    const endAngle = angle + (count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(startAngle - Math.PI / 2);
    const y1 = cy + r * Math.sin(startAngle - Math.PI / 2);
    const x2 = cx + r * Math.cos(endAngle - Math.PI / 2);
    const y2 = cy + r * Math.sin(endAngle - Math.PI / 2);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const color = getGradeColor(grade);
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${color}" stroke="#222" stroke-width="1" />`;
    angle = endAngle;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#222" stroke-width="2" /></svg>`;
}