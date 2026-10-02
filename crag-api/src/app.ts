import { generateGPX } from '@crag-to-all/shared-crag';
import cors from 'cors';
import express, { type Express } from 'express';
import type { Db } from 'mongodb';
import { asyncHandler, errorHandler, storageFailed, storageUnavailable } from './http';
import {
  cragImageStoragePath,
  imageUploadMiddleware,
  parseUploadedImage,
} from './images';
import {
  addSector,
  assertCragExists,
  createCrag,
  deleteSector,
  getAssembledCrag,
  listCrags,
  patchCrag,
  replaceSector,
} from './store';
import type { ImageStorage, ImageUploadResponse } from './types';
import { parseCragId, parseCreateCrag, parseCragPatch, parseReplaceSector, parseSectorId, parseSectorWrite } from './validate';

export interface AppOptions {
  storage?: ImageStorage;
}

export function createApp(db: Db, options: AppOptions = {}): Express {
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
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      res.json(await patchCrag(db, cragId, parseCragPatch(req.body)));
    }),
  );

  app.post(
    '/api/crags/:cragId/images',
    imageUploadMiddleware,
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const uploaded = parseUploadedImage(req.file);
      await assertCragExists(db, cragId);
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
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const created = await addSector(db, cragId, parseSectorWrite(req.body));
      res.status(201).location(`/api/crags/${cragId}/sectors/${created.id}`).json(created);
    }),
  );

  app.put(
    '/api/crags/:cragId/sectors/:sectorId',
    asyncHandler(async (req, res) => {
      const cragId = parseCragId(req.params.cragId);
      const sectorId = parseSectorId(req.params.sectorId);
      const { version, sector } = parseReplaceSector(req.body);
      res.json(await replaceSector(db, cragId, sectorId, version, sector));
    }),
  );

  app.delete(
    '/api/crags/:cragId/sectors/:sectorId',
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
