import { randomUUID } from 'node:crypto';
import { CRAG_MAP_MARKER_TYPES } from '@crag-to-all/shared-crag';
import { z, ZodError } from 'zod';
import { badRequest } from './http';
import type { CragCreateInput, CragPatchInput, SectorWriteInput } from './types';

const CRAG_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CRAG_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 200;
const MAX_TEXT_LENGTH = 2000;
/** One HTML document per description section, same cap as a route description. */
const MAX_DESCRIPTION_HTML_LENGTH = 20_000;

function nonemptyString(max: number) {
  return z.string().trim().min(1).max(max);
}

function slugifyCragId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

const cragIdSchema = z
  .string()
  .trim()
  .min(1, 'cragId is required')
  .max(MAX_CRAG_ID_LENGTH)
  .transform((value) => value.toLowerCase())
  .refine((value) => CRAG_ID_PATTERN.test(value), {
    message: 'cragId must be a lowercase slug (letters, digits, hyphens)',
  });

const sectorIdSchema = z.string().trim().min(1, 'sectorId is required');

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
  labelPositions: z.array(z.unknown()).optional(),
  lines: z.array(z.array(linePointSchema)).optional(),
});

const routeImageSchema = z.object({
  imageFile: nonemptyString(MAX_TEXT_LENGTH),
  routeIndex: z.number().int().min(0),
});

const routeVideoSchema = z.object({
  url: nonemptyString(MAX_TEXT_LENGTH),
  addedBy: nonemptyString(MAX_NAME_LENGTH),
});

const routeSchema = z.object({
  id: nonemptyString(128).optional(),
  name: nonemptyString(MAX_NAME_LENGTH),
  grade: nonemptyString(32),
  sectorName: nonemptyString(MAX_NAME_LENGTH).optional(),
  description: z.string().max(20_000).default(''),
  tags: z.array(nonemptyString(MAX_TEXT_LENGTH)).default([]),
  rating: z.number().finite().optional(),
  ratingVotes: nonemptyString(32).optional(),
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

const tilePackSchema = z.object({
  bbox: z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
  zoomMin: z.number().int().min(0),
  zoomMax: z.number().int().min(0),
  packVersion: z.number().int().min(1),
  fetchedAt: z.number().int().min(0),
  tileCount: z.number().int().min(0),
  totalBytes: z.number().int().min(0),
  archiveBytes: z.number().int().min(0),
});

const createCragBodySchema = z.object({
  name: nonemptyString(MAX_NAME_LENGTH),
  cragId: cragIdSchema.optional(),
});

const cragPatchSchema = z
  .object({
    version: versionSchema,
    name: nonemptyString(MAX_NAME_LENGTH).optional(),
    description: z.array(descriptionSchema).optional(),
    trails: z.array(trailSchema).optional(),
    markers: z.array(markerSchema).optional(),
    opentopoTilePack: tilePackSchema.nullable().optional(),
  })
  .refine(
    (patch) =>
      patch.name !== undefined ||
      patch.description !== undefined ||
      patch.trails !== undefined ||
      patch.markers !== undefined ||
      patch.opentopoTilePack !== undefined,
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
  externalId: nonemptyString(128).optional(),
});

const replaceSectorBodySchema = sectorBodySchema.extend({
  version: versionSchema,
});

function toSectorWrite(body: z.infer<typeof sectorBodySchema>): SectorWriteInput {
  const sector: SectorWriteInput = {
    name: body.name,
    geo: body.geo ?? null,
    routes: body.routes.map((route) => ({
      ...route,
      id: route.id ?? randomUUID(),
      sectorName: route.sectorName ?? body.name,
    })),
    images: body.images,
  };
  if (body.season !== undefined) sector.season = body.season;
  if (body.approachTime !== undefined) sector.approachTime = body.approachTime;
  if (body.altitude !== undefined) sector.altitude = body.altitude;
  if (body.orientation !== undefined) sector.orientation = body.orientation;
  if (body.timeInSun !== undefined) sector.timeInSun = body.timeInSun;
  if (body.externalId !== undefined) sector.externalId = body.externalId;
  return sector;
}

function parseCragId(value: unknown): string {
  return parseWith(cragIdSchema, value);
}

function parseSectorId(value: unknown): string {
  return parseWith(sectorIdSchema, value);
}

function parseCreateCrag(body: unknown): CragCreateInput {
  const { name, cragId } = parseWith(createCragBodySchema, body);
  if (cragId) return { name, cragId };
  const slug = slugifyCragId(name);
  if (!slug) {
    throw badRequest('name must contain letters or digits to derive cragId');
  }
  return { name, cragId: parseWith(cragIdSchema, slug) };
}

function parseCragPatch(body: unknown): CragPatchInput {
  return parseWith(cragPatchSchema, body);
}

function parseSectorWrite(body: unknown): SectorWriteInput {
  return toSectorWrite(parseWith(sectorBodySchema, body));
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
  parseReplaceSector,
  parseSectorId,
  parseSectorWrite,
  slugifyCragId,
};
