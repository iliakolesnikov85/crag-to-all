import { validateSectorName } from './sectorName';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const ORIENTATIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const ALTITUDE_ERROR = 'Enter altitude in whole meters.';
const APPROACH_ERROR = 'Enter approach time in whole minutes.';
const SUN_START_ERROR = 'Enter the start of the time in sun.';
const SUN_FORMAT_ERROR = 'Enter times as HH:MM.';

type Orientation = (typeof ORIENTATIONS)[number];
type MeasureSuffix = 'm' | 'min';

interface SectorEditSource {
  name: string;
  altitude?: string;
  approachTime?: string;
  season?: string;
  orientation?: string;
  timeInSun?: string;
}

interface SectorEditDraft {
  name: string;
  altitude: string;
  approachMinutes: string;
  months: number[];
  orientations: Orientation[];
  sunStart: string;
  sunEnd: string;
}

interface SectorDetailsPatch {
  name?: string;
  altitude?: string | null;
  approachTime?: string | null;
  season?: string | null;
  orientation?: string | null;
  timeInSun?: string | null;
}

interface SectorEditErrors {
  name?: string;
  altitude?: string;
  approachTime?: string;
  timeInSun?: string;
}

interface SunTime {
  start: string;
  end: string;
}

function monthIndex(token: string): number | undefined {
  const index = MONTHS.findIndex((month) => month.toLowerCase() === token.trim().toLowerCase());
  return index === -1 ? undefined : index;
}

function parseSeason(value: string | undefined): number[] {
  if (!value?.trim()) return [];
  const selected = new Set<number>();
  for (const part of value.split(';')) {
    const tokens = part.split(/\s+-\s+/).map((token) => token.trim()).filter(Boolean);
    if (tokens.length === 0) continue;
    const start = monthIndex(tokens[0]);
    const end = monthIndex(tokens[tokens.length - 1]);
    if (start === undefined || end === undefined) continue;
    let index = start;
    for (let step = 0; step < MONTHS.length; step += 1) {
      selected.add(index);
      if (index === end) break;
      index = (index + 1) % MONTHS.length;
    }
  }
  return [...selected].sort((a, b) => a - b);
}

function formatSeason(months: readonly number[]): string {
  const selected = new Set(months.filter((month) => month >= 0 && month < MONTHS.length));
  if (selected.size === 0) return '';
  if (selected.size === MONTHS.length) return 'Jan - Dec';

  const indices = [...selected].sort((a, b) => a - b);
  const runs: Array<[number, number]> = [];
  let start = indices[0];
  let previous = indices[0];
  for (let index = 1; index < indices.length; index += 1) {
    const month = indices[index];
    if (month === previous + 1) {
      previous = month;
      continue;
    }
    runs.push([start, previous]);
    start = month;
    previous = month;
  }
  runs.push([start, previous]);

  let ordered = runs;
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === MONTHS.length - 1) {
    const head = runs[0];
    const tail = runs[runs.length - 1];
    ordered = [[tail[0], head[1] + MONTHS.length], ...runs.slice(1, -1)];
  }

  return ordered
    .map(([from, to]) => {
      const startName = MONTHS[from];
      const endName = MONTHS[to % MONTHS.length];
      return from === to ? startName : `${startName} - ${endName}`;
    })
    .join('; ');
}

function parseOrientation(value: string | undefined): Orientation[] {
  if (!value?.trim()) return [];
  const selected = new Set<Orientation>();
  for (const part of value.split(',')) {
    const token = part.trim().toUpperCase();
    if ((ORIENTATIONS as readonly string[]).includes(token)) {
      selected.add(token as Orientation);
    }
  }
  return ORIENTATIONS.filter((direction) => selected.has(direction));
}

function formatOrientation(directions: readonly Orientation[]): string {
  const selected = new Set(directions);
  const ordered = ORIENTATIONS.filter((direction) => selected.has(direction));
  if (ordered.length === 0) return '';
  return `${ordered.join(', ')},`;
}

function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

function parseTimeInSun(value: string | undefined): SunTime {
  const empty = { start: '', end: '' };
  if (!value?.trim()) return empty;
  const match = value.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})?$/);
  if (!match) return empty;
  const start = normalizeTime(match[1]);
  if (!start) return empty;
  if (!match[2]) return { start, end: '' };
  const end = normalizeTime(match[2]);
  if (!end) return empty;
  return { start, end };
}

function formatTimeInSun(time: SunTime): string {
  if (!time.start) return '';
  if (!time.end) return `${time.start} -`;
  return `${time.start} - ${time.end}`;
}

function parseWholeNumber(value: string | undefined, suffix: MeasureSuffix): string {
  if (!value?.trim()) return '';
  const match = value.trim().match(new RegExp(`^(\\d+)(?:\\s*${suffix})?$`, 'i'));
  if (!match) return '';
  const digits = match[1];
  const numeric = Number(digits);
  if (Number.isSafeInteger(numeric)) return String(numeric);
  return digits;
}

function formatMeasure(digits: string, suffix: MeasureSuffix): string {
  if (!digits) return '';
  return `${digits}${suffix}`;
}

function changedValue(previous: string, next: string): string | null | undefined {
  if (next === previous) return undefined;
  return next === '' ? null : next;
}

function measureChange(
  original: string | undefined,
  digits: string,
  suffix: MeasureSuffix,
  error: string,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  const trimmed = digits.trim();
  if (trimmed && !/^\d+$/.test(trimmed)) return { ok: false, error };
  const next = formatMeasure(trimmed, suffix);
  const previous = formatMeasure(parseWholeNumber(original, suffix), suffix);
  return { ok: true, value: changedValue(previous, next) };
}

function sunChange(
  original: string | undefined,
  start: string,
  end: string,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  const startTime = start.trim();
  const endTime = end.trim();
  if (endTime && !startTime) return { ok: false, error: SUN_START_ERROR };
  const normalizedStart = startTime ? normalizeTime(startTime) : '';
  const normalizedEnd = endTime ? normalizeTime(endTime) : '';
  if (startTime && !normalizedStart) return { ok: false, error: SUN_FORMAT_ERROR };
  if (endTime && !normalizedEnd) return { ok: false, error: SUN_FORMAT_ERROR };
  const next = formatTimeInSun({ start: normalizedStart || '', end: normalizedEnd || '' });
  const previous = formatTimeInSun(parseTimeInSun(original));
  return { ok: true, value: changedValue(previous, next) };
}

function sectorEditDraft(source: SectorEditSource): SectorEditDraft {
  const sun = parseTimeInSun(source.timeInSun);
  return {
    name: source.name,
    altitude: parseWholeNumber(source.altitude, 'm'),
    approachMinutes: parseWholeNumber(source.approachTime, 'min'),
    months: parseSeason(source.season),
    orientations: parseOrientation(source.orientation),
    sunStart: sun.start,
    sunEnd: sun.end,
  };
}

function buildSectorEditPatch(
  source: SectorEditSource,
  draft: SectorEditDraft,
  takenNames: readonly string[],
): { ok: true; patch: SectorDetailsPatch } | { ok: false; errors: SectorEditErrors } {
  const errors: SectorEditErrors = {};
  const name = validateSectorName(draft.name, takenNames);
  const altitude = measureChange(source.altitude, draft.altitude, 'm', ALTITUDE_ERROR);
  const approach = measureChange(source.approachTime, draft.approachMinutes, 'min', APPROACH_ERROR);
  const sun = sunChange(source.timeInSun, draft.sunStart, draft.sunEnd);
  if (!name.ok) errors.name = name.error;
  if (!altitude.ok) errors.altitude = altitude.error;
  if (!approach.ok) errors.approachTime = approach.error;
  if (!sun.ok) errors.timeInSun = sun.error;
  if (!name.ok || !altitude.ok || !approach.ok || !sun.ok) {
    return { ok: false, errors };
  }

  const season = changedValue(formatSeason(parseSeason(source.season)), formatSeason(draft.months));
  const orientation = changedValue(
    formatOrientation(parseOrientation(source.orientation)),
    formatOrientation(draft.orientations),
  );
  const patch: SectorDetailsPatch = {};
  if (name.name !== source.name) patch.name = name.name;
  if (altitude.value !== undefined) patch.altitude = altitude.value;
  if (approach.value !== undefined) patch.approachTime = approach.value;
  if (season !== undefined) patch.season = season;
  if (orientation !== undefined) patch.orientation = orientation;
  if (sun.value !== undefined) patch.timeInSun = sun.value;
  return { ok: true, patch };
}

export type { Orientation, SectorDetailsPatch, SectorEditDraft, SectorEditErrors, SectorEditSource };

export { MONTHS, ORIENTATIONS, buildSectorEditPatch, sectorEditDraft };
