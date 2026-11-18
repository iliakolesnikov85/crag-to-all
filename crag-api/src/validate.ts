import { randomUUID } from 'node:crypto';
import {
  CRAG_EXTERNAL_ID_FORBIDDEN_MESSAGE,
  CRAG_EXTERNAL_ID_REQUIRED_MESSAGE,
  CRAG_ID_MAX_LENGTH,
  CRAG_MAP_MARKER_TYPES,
  CRAG_SOURCES,
  ROUTE_TYPES,
  validateCragExternalId,
  validateCragId,
  validateCragName,
  type CragFieldCheck,
  type Route,
} from '@crag-to-all/shared-crag';
import { z, ZodError } from 'zod';
import { badRequest } from './http';
import type {
  CragCreateInput,
  CragMemberRole,
  CragPatchInput,
  SectorPatch,
  SectorWriteInput,
} from './types';

const MAX_NAME_LENGTH = 200;
const MAX_TEXT_LENGTH = 2000;
/** One HTML document per description section, same cap as a route description. */
const MAX_DESCRIPTION_HTML_LENGTH = 20_000;

function nonemptyString(max: number) {
  return z.string().trim().min(1).max(max);
}

function formatIssue(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(formatIssue(result.error));
  }
  return result.data;
}

function cragString(validate: (value: string) => CragFieldCheck) {
  return z.string().superRefine((value, ctx) => {
    const result = validate(value);
    if (!result.ok) ctx.addIssue(result.error);
  }).transform((value) => value.trim());
}

const cragIdSchema = z
  .string()
  .trim()
  .min(1, 'cragId is required')
  .max(CRAG_ID_MAX_LENGTH)
  .transform((value) => value.toLowerCase())
  .refine((value) => validateCragId(value).ok, {
    message: 'cragId must be a lowercase slug (letters, digits, hyphens)',
  });

/** Create body `id`. Unlike a URL cragId, this is not lowercased for the caller. */
const createCragIdSchema = cragString(validateCragId);

const sectorIdSchema = z.string().trim().min(1, 'sectorId is required');

const memberUserIdSchema = z.string().trim().min(1, 'userId is required').max(128);

const memberRoleBodySchema = z.object({
  role: z.enum(['owner', 'admin']),
});

const accountEmailSchema = z
  .string()
  .min(1, 'email is required')
  .max(320, 'email is too long')
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: 'email must be an email address',
  });

const versionSchema = z.number().int().min(1);

const latLngSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90),
  lon: z.number().finite().gte(-180).lte(180),
});

const linePointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const imageSchema = z.object({
  imageFile: nonemptyString(MAX_TEXT_LENGTH),
});

const routeImageSchema = z.object({
  imageFile: nonemptyString(MAX_TEXT_LENGTH),
  routeIndex: z.number().int().min(0),
  line: z.array(linePointSchema).optional(),
});

const routeVideoSchema = z.object({
  url: nonemptyString(MAX_TEXT_LENGTH),
  addedBy: nonemptyString(MAX_NAME_LENGTH),
});

const routeSchema = z.object({
  id: nonemptyString(128).optional(),
  name: nonemptyString(MAX_NAME_LENGTH),
  /** Scraped routes can omit a grade. An empty grade must not reject the rest of the patch. */
  grade: z.string().trim().max(32).default(''),
  sectorName: nonemptyString(MAX_NAME_LENGTH).optional(),
  description: z.string().max(20_000).default(''),
  tags: z.array(nonemptyString(MAX_TEXT_LENGTH)).default([]),
  /** Blank or null means the route has no discipline. */
  type: z
    .union([z.enum(ROUTE_TYPES), z.string().trim().pipe(z.literal('')), z.null()])
    .optional()
    .transform((value) => (value ? value : undefined)),
  rating: z.number().finite().optional(),
  ratingVotes: nonemptyString(32).optional(),
  height: z.number().finite().positive().max(999).optional(),
  images: z.array(routeImageSchema).default([]),
  videos: z.array(routeVideoSchema).optional(),
});

const descriptionSchema = z.object({
  subheader: nonemptyString(MAX_NAME_LENGTH),
  paragraphs: z.array(nonemptyString(MAX_DESCRIPTION_HTML_LENGTH)),
});

const trailSchema = z.object({
  name: nonemptyString(MAX_NAME_LENGTH),
  color: nonemptyString(32),
  points: z.array(latLngSchema),
});

const markerSchema = z.object({
  type: z.enum(CRAG_MAP_MARKER_TYPES),
  info: z.string().trim().max(MAX_TEXT_LENGTH).default(''),
  geo: latLngSchema,
});

const createCragBodySchema = z
  .strictObject({
    id: createCragIdSchema,
    name: cragString(validateCragName),
    source: z.enum(CRAG_SOURCES).default('explorer'),
    externalId: cragString(validateCragExternalId).optional(),
  })
  .refine(
    (body) => body.source !== 'external' || body.externalId !== undefined,
    { message: CRAG_EXTERNAL_ID_REQUIRED_MESSAGE, path: ['externalId'] },
  )
  .refine(
    (body) => body.source === 'external' || body.externalId === undefined,
    { message: CRAG_EXTERNAL_ID_FORBIDDEN_MESSAGE, path: ['externalId'] },
  );

const cragPatchSchema = z
  .strictObject({
    version: versionSchema,
    name: cragString(validateCragName).optional(),
    description: z.array(descriptionSchema).optional(),
    trails: z.array(trailSchema).optional(),
    markers: z.array(markerSchema).optional(),
  })
  .refine(
    (patch) =>
      patch.name !== undefined ||
      patch.description !== undefined ||
      patch.trails !== undefined ||
      patch.markers !== undefined,
    { message: 'PATCH body must include at least one crag field besides version' },
  );

const sectorBodySchema = z.object({
  name: nonemptyString(MAX_NAME_LENGTH),
  geo: latLngSchema.nullable().optional(),
  season: nonemptyString(MAX_TEXT_LENGTH).optional(),
  approachTime: nonemptyString(MAX_TEXT_LENGTH).optional(),
  altitude: nonemptyString(MAX_TEXT_LENGTH).optional(),
  orientation: nonemptyString(MAX_TEXT_LENGTH).optional(),
  timeInSun: nonemptyString(MAX_TEXT_LENGTH).optional(),
  routes: z.array(routeSchema).default([]),
  images: z.array(imageSchema).default([]),
});

const replaceSectorBodySchema = sectorBodySchema.extend({
  version: versionSchema,
});

const clearableText = nonemptyString(MAX_TEXT_LENGTH).nullable().optional();

const sectorGeoPatchSchema = z
  .object({
    version: versionSchema,
    geo: latLngSchema.optional(),
    name: nonemptyString(MAX_NAME_LENGTH).optional(),
    season: clearableText,
    approachTime: clearableText,
    altitude: clearableText,
    orientation: clearableText,
    timeInSun: clearableText,
    routes: z.array(routeSchema).optional(),
    images: z.array(imageSchema).optional(),
  })
  .refine(
    (patch) =>
      patch.geo !== undefined ||
      patch.name !== undefined ||
      patch.season !== undefined ||
      patch.approachTime !== undefined ||
      patch.altitude !== undefined ||
      patch.orientation !== undefined ||
      patch.timeInSun !== undefined ||
      patch.routes !== undefined ||
      patch.images !== undefined,
    { message: 'PATCH body must include at least one sector field besides version' },
  );

function normalizeRoutes(routes: z.infer<typeof routeSchema>[]): Route[] {
  return routes.map((route) => {
    const normalized: Route = {
      id: route.id ?? randomUUID(),
      name: route.name,
      grade: route.grade,
      sectorName: route.sectorName ?? '',
      description: route.description,
      tags: route.tags,
      images: route.images,
    };
    if (route.rating !== undefined) normalized.rating = route.rating;
    if (route.ratingVotes !== undefined) normalized.ratingVotes = route.ratingVotes;
    if (route.type !== undefined) normalized.type = route.type;
    if (route.height !== undefined) normalized.height = route.height;
    if (route.videos !== undefined) normalized.videos = route.videos;
    return normalized;
  });
}

function toSectorWrite(body: z.infer<typeof sectorBodySchema>): SectorWriteInput {
  const sector: SectorWriteInput = {
    name: body.name,
    geo: body.geo ?? null,
    routes: normalizeRoutes(body.routes).map((route) => ({
      ...route,
      sectorName: body.name,
    })),
    images: body.images,
  };
  if (body.season !== undefined) sector.season = body.season;
  if (body.approachTime !== undefined) sector.approachTime = body.approachTime;
  if (body.altitude !== undefined) sector.altitude = body.altitude;
  if (body.orientation !== undefined) sector.orientation = body.orientation;
  if (body.timeInSun !== undefined) sector.timeInSun = body.timeInSun;
  return sector;
}

function parseCragId(value: unknown): string {
  return parseWith(cragIdSchema, value);
}

function parseSectorId(value: unknown): string {
  return parseWith(sectorIdSchema, value);
}

function parseMemberUserId(value: unknown): string {
  return parseWith(memberUserIdSchema, value);
}

function parseMemberRole(body: unknown): CragMemberRole {
  return parseWith(memberRoleBodySchema, body).role;
}

function parseAccountEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw badRequest('email is required');
  }
  return parseWith(accountEmailSchema, value.trim().toLowerCase());
}

function parseCreateCrag(body: unknown): CragCreateInput {
  const parsed = parseWith(createCragBodySchema, body);
  const input: CragCreateInput = {
    name: parsed.name,
    cragId: parsed.id,
    source: parsed.source,
  };
  if (parsed.externalId !== undefined) input.externalId = parsed.externalId;
  return input;
}

function parseCragPatch(body: unknown): CragPatchInput {
  return parseWith(cragPatchSchema, body);
}

function parseSectorWrite(body: unknown): SectorWriteInput {
  return toSectorWrite(parseWith(sectorBodySchema, body));
}

function parseSectorPatch(body: unknown): SectorPatch & { version: number } {
  const parsed = parseWith(sectorGeoPatchSchema, body);
  const patch: SectorPatch & { version: number } = { version: parsed.version };
  if (parsed.geo !== undefined) patch.geo = parsed.geo;
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.season !== undefined) patch.season = parsed.season;
  if (parsed.approachTime !== undefined) patch.approachTime = parsed.approachTime;
  if (parsed.altitude !== undefined) patch.altitude = parsed.altitude;
  if (parsed.orientation !== undefined) patch.orientation = parsed.orientation;
  if (parsed.timeInSun !== undefined) patch.timeInSun = parsed.timeInSun;
  if (parsed.routes !== undefined) patch.routes = normalizeRoutes(parsed.routes);
  if (parsed.images !== undefined) patch.images = parsed.images;
  return patch;
}

function parseReplaceSector(body: unknown): { version: number; sector: SectorWriteInput } {
  const parsed = parseWith(replaceSectorBodySchema, body);
  const { version, ...sectorBody } = parsed;
  return { version, sector: toSectorWrite(sectorBody) };
}

export {
  parseCragId,
  parseCragPatch,
  parseCreateCrag,
  parseAccountEmail,
  parseMemberRole,
  parseMemberUserId,
  parseReplaceSector,
  parseSectorPatch,
  parseSectorId,
  parseSectorWrite,
};
