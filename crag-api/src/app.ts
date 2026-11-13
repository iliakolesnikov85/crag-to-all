import { generateGPX } from '@crag-to-all/shared-crag';
import cors from 'cors';
import express, { type Express, type Request, type RequestHandler } from 'express';
import type { Db } from 'mongodb';
import { asyncHandler, errorHandler, forbidden, storageFailed, storageUnavailable, unauthorized } from './http';
import {
  cragImageStoragePath,
  imageUploadMiddleware,
  parseUploadedImage,
} from './images';
import {
  addSector,
  createCrag,
  deleteMember,
  deleteSector,
  getAssembledCrag,
  listCallerMemberships,
  listCrags,
  listMembers,
  patchCrag,
  patchSector,
  replaceSector,
  requireWritableCrag,
  upsertMember,
} from './store';
import type { AuthCaller, CragDocument, IdTokenVerifier, ImageStorage, ImageUploadResponse } from './types';
import { parseCragId, parseCreateCrag, parseCragPatch, parseMemberRole, parseMemberUserId, parseReplaceSector, parseSectorPatch, parseSectorId, parseSectorWrite } from './validate';

function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token, extra] = header.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token || extra !== undefined) {
    return null;
  }
  return token;
}

function loadedCrag(req: Request): CragDocument {
  if (!req.writableCrag) {
    throw unauthorized();
  }
  return req.writableCrag;
}

function loadedCaller(req: Request): AuthCaller {
  if (!req.caller) {
    throw unauthorized();
  }
  return req.caller;
}

function requireCragWrite(db: Db): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const caller = loadedCaller(req);
    const cragId = parseCragId(req.params.cragId);
    req.writableCrag = await requireWritableCrag(db, cragId, caller);
    next();
  });
}

/** Creating a crag is superadmin-only. An owner or admin of another crag is not enough. */
function requireSuperadmin(): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (!loadedCaller(req).superadmin) {
      throw forbidden();
    }
    next();
  });
}

export interface AppOptions {
  storage?: ImageStorage;
  auth?: IdTokenVerifier;
}

export function requireAuth(auth: IdTokenVerifier | undefined): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const token = readBearerToken(req.get('authorization'));
    if (!token) {
      throw unauthorized();
    }
    if (!auth) {
      console.error('Rejected a crag write because no ID token verifier is configured');
      throw unauthorized();
    }
    let caller: AuthCaller;
    try {
      caller = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Rejected a crag write because the ID token could not be verified:', error);
      throw unauthorized();
    }
    req.caller = caller;
    next();
  });
}

export function createApp(db: Db, options: AppOptions = {}): Express {
  const authenticate = requireAuth(options.auth);
  const writableCrag = requireCragWrite(db);
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/', (_req, res) => {
    res.json({ name: 'crag-api' });
  });

  app.get(
    '/api/crags',
    asyncHandler(async (_req, res) => {
      res.json(await listCrags(db));
    }),
  );

  app.post(
    '/api/crags',
    authenticate,
    requireSuperadmin(),
    asyncHandler(async (req, res) => {
      const created = await createCrag(db, parseCreateCrag(req.body));
      res.status(201).location(`/api/crags/${created.cragId}`).json(created);
    }),
  );

  app.get(
    '/api/crags/:cragId/gpx',
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const crag = await getAssembledCrag(db, cragId);
      const xml = generateGPX(
        crag.sectors,
        crag.trails ?? [],
        crag.markers ?? [],
        crag.name,
      );
      res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${cragId}-sectors.gpx"`,
      );
      res.send(xml);
    }),
  );

  app.get(
    '/api/crags/:cragId',
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      res.json(await getAssembledCrag(db, cragId));
    }),
  );

  app.patch(
    '/api/crags/:cragId',
    authenticate,
    writableCrag,
    asyncHandler(async (req, res) => {
      res.json(await patchCrag(db, loadedCrag(req), parseCragPatch(req.body)));
    }),
  );

  app.get(
    '/api/me/memberships',
    authenticate,
    asyncHandler(async (req, res) => {
      res.json({ memberships: await listCallerMemberships(db, loadedCaller(req)) });
    }),
  );

  app.get(
    '/api/crags/:cragId/members',
    authenticate,
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      res.json(await listMembers(db, cragId, loadedCaller(req)));
    }),
  );

  app.put(
    '/api/crags/:cragId/members/:userId',
    authenticate,
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const userId = parseMemberUserId(req.params.userId);
      const role = parseMemberRole(req.body);
      res.json(await upsertMember(db, cragId, userId, role, loadedCaller(req)));
    }),
  );

  app.delete(
    '/api/crags/:cragId/members/:userId',
    authenticate,
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const userId = parseMemberUserId(req.params.userId);
      await deleteMember(db, cragId, userId, loadedCaller(req));
      res.status(204).send();
    }),
  );

  app.post(
    '/api/crags/:cragId/images',
    authenticate,
    writableCrag,
    imageUploadMiddleware,
    asyncHandler(async (req, res) => {
      const cragId = loadedCrag(req)._id;
      const uploaded = parseUploadedImage(req.file);
      if (!options.storage) {
        throw storageUnavailable();
      }
      const storagePath = cragImageStoragePath(cragId, uploaded.imageFile);
      try {
        await options.storage.uploadImage(storagePath, uploaded.buffer);
      } catch (error) {
        console.error(`Failed to upload image for crag ${cragId}:`, error);
        throw storageFailed();
      }
      const body: ImageUploadResponse = {
        imageFile: uploaded.imageFile,
        storagePath,
      };
      res.status(201).json(body);
    }),
  );

  app.post(
    '/api/crags/:cragId/sectors',
    authenticate,
    writableCrag,
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const created = await addSector(db, cragId, parseSectorWrite(req.body));
      res.status(201).location(`/api/crags/${cragId}/sectors/${created.id}`).json(created);
    }),
  );

  app.put(
    '/api/crags/:cragId/sectors/:sectorId',
    authenticate,
    writableCrag,
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const sectorId = parseSectorId(req.params.sectorId);
      const { version, sector } = parseReplaceSector(req.body);
      res.json(await replaceSector(db, cragId, sectorId, version, sector));
    }),
  );

  app.patch(
    '/api/crags/:cragId/sectors/:sectorId',
    authenticate,
    writableCrag,
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const sectorId = parseSectorId(req.params.sectorId);
      const patch = parseSectorPatch(req.body);
      res.json(await patchSector(db, cragId, sectorId, patch.version, patch));
    }),
  );

  app.delete(
    '/api/crags/:cragId/sectors/:sectorId',
    authenticate,
    writableCrag,
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const sectorId = parseSectorId(req.params.sectorId);
      await deleteSector(db, cragId, sectorId);
      res.status(204).send();
    }),
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });
  app.use(errorHandler);
  return app;
}
