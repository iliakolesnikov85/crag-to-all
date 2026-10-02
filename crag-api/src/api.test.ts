import { createHash } from 'node:crypto';
import { MongoClient, type Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { IMAGE_FIELD_NAME } from './images';
import { ensureIndexes } from './store';
import type { ImageStorage } from './types';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('crag-api', () => {
  let mongod: MongoMemoryServer | undefined;
  let client: MongoClient | undefined;
  let db!: Db;
  let app!: ReturnType<typeof createApp>;
  const uploaded = new Map<string, Buffer>();
  const storage: ImageStorage = {
    async uploadImage(storagePath, data) {
      uploaded.set(storagePath, data);
    },
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
    db = client.db('crag-api-test');
    await ensureIndexes(db);
    app = createApp(db, { storage });
  });

  afterAll(async () => {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error('Failed to close MongoDB test client:', error);
      }
    }
    if (mongod) {
      try {
        await mongod.stop();
      } catch (error) {
        console.error('Failed to stop MongoMemoryServer:', error);
      }
    }
  });

  beforeEach(async () => {
    await db.collection('crags').deleteMany({});
    await db.collection('sectors').deleteMany({});
    uploaded.clear();
  });

  it('returns an empty catalog from a fresh database', async () => {
    const res = await request(app).get('/api/crags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates an explorer crag via POST and assembles it on GET', async () => {
    const created = await request(app).post('/api/crags').send({ name: 'Roshka' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: 'roshka',
      cragId: 'roshka',
      cragName: 'Roshka',
      source: 'explorer',
      version: 1,
    });

    const catalog = await request(app).get('/api/crags');
    expect(catalog.body).toEqual([
      { id: 'roshka', cragId: 'roshka', cragName: 'Roshka', source: 'explorer' },
    ]);

    const crag = await request(app).get('/api/crags/roshka');
    expect(crag.status).toBe(200);
    expect(crag.body.name).toBe('Roshka');
    expect(crag.body.id).toBe('roshka');
    expect(crag.body.cragId).toBe('roshka');
    expect(crag.body.sectors).toEqual([]);
    expect(crag.body.protocolVersion).toBe(1);
    expect(crag.body.source).toBe('explorer');
  });

  it('rejects a duplicate crag id with 409', async () => {
    await request(app).post('/api/crags').send({ name: 'Roshka', cragId: 'roshka' });
    const res = await request(app).post('/api/crags').send({ name: 'Other', cragId: 'roshka' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_exists');
  });

  it('patches crag-level fields and returns 409 on a stale version', async () => {
    await request(app).post('/api/crags').send({ name: 'Roshka', cragId: 'roshka' });

    const stale = await request(app)
      .patch('/api/crags/roshka')
      .send({ version: 99, name: 'Nope' });
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: 'version_conflict', currentVersion: 1 });

    const patched = await request(app)
      .patch('/api/crags/roshka')
      .send({
        version: 1,
        name: 'Roshka Valley',
        description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
      });
    expect(patched.status).toBe(200);
    expect(patched.body.version).toBe(2);
    expect(patched.body.cragName).toBe('Roshka Valley');
    expect(patched.body.description).toEqual([
      { subheader: 'Access', paragraphs: ['Walk in.'] },
    ]);
  });

  it('adds, replaces, and deletes sectors without touching other documents', async () => {
    await request(app).post('/api/crags').send({ name: 'Roshka', cragId: 'roshka' });

    const created = await request(app)
      .post('/api/crags/roshka/sectors')
      .send({
        name: 'Main Wall',
        geo: { lat: 42.5, lon: 45.2 },
        routes: [{ name: 'Classic', grade: '6a' }],
      });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Main Wall');
    expect(created.body.version).toBe(1);
    expect(created.body.routes[0].id).toEqual(expect.any(String));
    const sectorId = created.body.id as string;

    const assembled = await request(app).get('/api/crags/roshka');
    expect(assembled.body.sectors).toHaveLength(1);
    expect(assembled.body.sectors[0].id).toBe(sectorId);

    const replaced = await request(app)
      .put(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 1, name: 'Cave', geo: null });
    expect(replaced.status).toBe(200);
    expect(replaced.body.version).toBe(2);
    expect(replaced.body.name).toBe('Cave');

    const conflict = await request(app)
      .put(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 1, name: 'Old name', geo: null });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: 'version_conflict', currentVersion: 2 });

    const removed = await request(app).delete(`/api/crags/roshka/sectors/${sectorId}`);
    expect(removed.status).toBe(204);

    const afterDelete = await request(app).get('/api/crags/roshka');
    expect(afterDelete.body.sectors).toEqual([]);
    expect(afterDelete.body.version).toBe(1);
  });

  it('returns 404 for a missing crag or sector', async () => {
    const missingCrag = await request(app).get('/api/crags/missing');
    expect(missingCrag.status).toBe(404);

    await request(app).post('/api/crags').send({ name: 'Roshka', cragId: 'roshka' });
    const missingSector = await request(app).delete(
      '/api/crags/roshka/sectors/00000000-0000-0000-0000-000000000000',
    );
    expect(missingSector.status).toBe(404);
  });

  it('builds GPX from the current database state without writing to Storage', async () => {
    await request(app).post('/api/crags').send({ name: 'Roshka', cragId: 'roshka' });
    await request(app).post('/api/crags/roshka/sectors').send({
      name: 'Cave',
      geo: { lat: 44.1, lon: 6.2 },
    });
    await request(app)
      .patch('/api/crags/roshka')
      .send({
        version: 1,
        trails: [
          {
            name: 'Approach',
            color: '#00f',
            points: [
              { lat: 44.1, lon: 6.2 },
              { lat: 44.11, lon: 6.21 },
            ],
          },
        ],
        markers: [{ type: 'parking_space', info: 'Lot A', geo: { lat: 44.0, lon: 6.0 } }],
      });

    const res = await request(app).get('/api/crags/roshka/gpx');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/gpx\+xml/);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="roshka-sectors.gpx"',
    );
    expect(res.text).toContain('<name>Cave</name>');
    expect(res.text).toContain('<name>Parking: Lot A</name>');
    expect(res.text).toContain('<name>Trail: Approach</name>');
    expect(uploaded.size).toBe(0);

    const missing = await request(app).get('/api/crags/missing/gpx');
    expect(missing.status).toBe(404);
  });

  it('uploads an image to Storage as {cragId}/images/{hash}.ext', async () => {
    await request(app).post('/api/crags').send({ name: 'Roshka', cragId: 'roshka' });

    const res = await request(app)
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.jpg', contentType: 'image/jpeg' });

    const hash = createHash('sha256').update(PNG_1X1).digest('hex');
    const imageFile = `${hash}.png`;
    const storagePath = `roshka/images/${imageFile}`;
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ imageFile, storagePath });
    expect(uploaded.get(storagePath)?.equals(PNG_1X1)).toBe(true);

    const missingCrag = await request(app)
      .post('/api/crags/missing/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.png', contentType: 'image/png' });
    expect(missingCrag.status).toBe(404);

    const notImage = await request(app)
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, Buffer.from('hello'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    expect(notImage.status).toBe(400);
  });

  it('returns 503 when image storage is not configured and 502 when upload fails', async () => {
    await request(app).post('/api/crags').send({ name: 'Roshka', cragId: 'roshka' });

    const noStorageApp = createApp(db);
    const unavailable = await request(noStorageApp)
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.png', contentType: 'image/png' });
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error).toBe('storage_unavailable');

    const failing: ImageStorage = {
      async uploadImage() {
        throw new Error('emulator down');
      },
    };
    const failingApp = createApp(db, { storage: failing });
    const failed = await request(failingApp)
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.png', contentType: 'image/png' });
    expect(failed.status).toBe(502);
    expect(failed.body.error).toBe('storage_failed');
  });
});
