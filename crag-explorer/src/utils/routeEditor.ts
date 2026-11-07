import { ROUTE_TYPES, type Route, type RouteType } from '../types';

const ROUTE_NAME_MAX_LENGTH = 200;
const EMPTY_NAME_ERROR = 'Enter a route name.';
const LONG_NAME_ERROR = `Route name must be ${ROUTE_NAME_MAX_LENGTH} characters or fewer.`;
const DUPLICATE_NAME_ERROR = 'A route with this name already exists.';
const HEIGHT_ERROR = 'Enter a height in meters.';

const LOW_GRADES = ['3', '4', '5'] as const;
const HIGH_GRADES = ['6', '7', '8', '9'] as const;
const GRADE_LETTERS = ['A', 'B', 'C'] as const;

const FONT_GRADES: readonly string[] = [
  '?',
  ...LOW_GRADES.flatMap((grade) => [grade, `${grade}+`]),
  ...HIGH_GRADES.flatMap((grade) =>
    GRADE_LETTERS.flatMap((letter) => [`${grade}${letter}`, `${grade}${letter}+`]),
  ),
];

const ROUTE_TAG_GROUPS = [
  { label: 'Holds', tags: ['Crimpers', 'Slopers', 'Jugs', 'Crack', 'Pockets', 'Tufas'] },
  { label: 'Style', tags: ['Fingery', 'Powerful', 'Dyno', 'Endurance', 'Technical', 'Mental'] },
  { label: 'Steepness', tags: ['Roof', 'Overhang', 'Vertical', 'Slab', 'Traverse'] },
  { label: 'Other properties', tags: ['Sit start', 'Tops last hold', 'Trad gear required', 'Dangerous'] },
] as const;

const CATALOG_TAGS: readonly string[] = ROUTE_TAG_GROUPS.flatMap((group) => [...group.tags]);

interface RouteNameSuccess {
  ok: true;
  name: string;
}

interface RouteNameFailure {
  ok: false;
  error: string;
}

interface RouteEditDraft {
  name: string;
  grade: string;
  description: string;
  type: RouteType | '';
  rating: number | undefined;
  height: string;
  tags: string[];
}

interface RouteEditErrors {
  name?: string;
  height?: string;
}

interface RouteWriteSuccess {
  ok: true;
  route: Route;
}

interface RouteWriteFailure {
  ok: false;
  errors: RouteEditErrors;
}

function validateRouteName(value: string, takenNames: readonly string[]): RouteNameSuccess | RouteNameFailure {
  const name = value.trim();
  if (!name) return { ok: false, error: EMPTY_NAME_ERROR };
  if (name.length > ROUTE_NAME_MAX_LENGTH) return { ok: false, error: LONG_NAME_ERROR };
  const key = name.toLowerCase();
  const taken = takenNames.some((takenName) => takenName.trim().toLowerCase() === key);
  if (taken) return { ok: false, error: DUPLICATE_NAME_ERROR };
  return { ok: true, name };
}

function parseHeight(value: string): { ok: true; height?: number } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, error: HEIGHT_ERROR };
  const height = Number(trimmed);
  if (!Number.isFinite(height) || height <= 0 || height > 999) {
    return { ok: false, error: HEIGHT_ERROR };
  }
  return { ok: true, height };
}

function sameTags(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function isRouteType(value: string | undefined): value is RouteType {
  return value !== undefined && (ROUTE_TYPES as readonly string[]).includes(value);
}

function initialRouteType(route: Route): RouteType | '' {
  return isRouteType(route.type) ? route.type : '';
}

function routeEditDraft(route: Route | null): RouteEditDraft {
  if (!route) {
    return {
      name: '',
      grade: '?',
      description: '',
      type: '',
      rating: undefined,
      height: '',
      tags: [],
    };
  }
  return {
    name: route.name,
    grade: route.grade.trim() || '?',
    description: route.description,
    type: initialRouteType(route),
    rating: route.rating,
    height: route.height === undefined ? '' : String(route.height),
    tags: [...route.tags],
  };
}

function sameRouteDraft(left: RouteEditDraft, right: RouteEditDraft): boolean {
  return left.name === right.name
    && left.grade === right.grade
    && left.description === right.description
    && left.type === right.type
    && left.rating === right.rating
    && left.height === right.height
    && sameTags(left.tags, right.tags);
}

function gradeChoices(current: string): string[] {
  if (FONT_GRADES.includes(current)) return [...FONT_GRADES];
  return [current, ...FONT_GRADES];
}

function toggleRouteTag(tags: readonly string[], tag: string): string[] {
  const next = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
  const known = CATALOG_TAGS.filter((item) => next.includes(item));
  const extra = next.filter((item) => !CATALOG_TAGS.includes(item));
  return [...known, ...extra];
}

function buildRouteWrite(
  sectorName: string,
  existing: Route | null,
  draft: RouteEditDraft,
  takenNames: readonly string[],
): RouteWriteSuccess | RouteWriteFailure {
  const nameResult = validateRouteName(draft.name, takenNames);
  const heightResult = parseHeight(draft.height);
  if (!nameResult.ok || !heightResult.ok) {
    const errors: RouteEditErrors = {};
    if (!nameResult.ok) errors.name = nameResult.error;
    if (!heightResult.ok) errors.height = heightResult.error;
    return { ok: false, errors };
  }

  const ratingChanged = draft.rating !== existing?.rating;
  const route: Route = {
    id: existing?.id ?? crypto.randomUUID(),
    name: nameResult.name,
    grade: draft.grade.trim() || '?',
    sectorName,
    description: draft.description,
    tags: [...draft.tags],
    images: existing?.images ? existing.images.map((image) => ({ ...image })) : [],
  };
  if (isRouteType(draft.type)) route.type = draft.type;
  if (existing?.videos) route.videos = existing.videos.map((video) => ({ ...video }));
  if (ratingChanged) {
    if (draft.rating !== undefined && draft.rating > 0) route.rating = draft.rating;
  } else {
    if (existing?.rating !== undefined) route.rating = existing.rating;
    if (existing?.ratingVotes) route.ratingVotes = existing.ratingVotes;
  }
  if (heightResult.height !== undefined) route.height = heightResult.height;
  return { ok: true, route };
}

export {
  FONT_GRADES,
  ROUTE_NAME_MAX_LENGTH,
  ROUTE_TAG_GROUPS,
  ROUTE_TYPES,
  buildRouteWrite,
  gradeChoices,
  routeEditDraft,
  sameRouteDraft,
  toggleRouteTag,
};

export type { RouteEditDraft, RouteEditErrors };
