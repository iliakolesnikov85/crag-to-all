import { createHash } from 'node:crypto';
import { CRAG_DATA_PROTOCOL } from '@crag-to-all/shared-crag';
import { type Db, MongoClient } from '@crag-to-all/shared-firebase';
import type { Express } from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { IMAGE_FIELD_NAME } from './images';
import { ensureIndexes } from './store';
import type { AuthAccountProfile, AuthCaller, AuthDirectory, IdTokenVerifier, ImageStorage } from './types';

const TEST_TOKEN = 'test-token';
const TEST_EMAIL = 'editor@example.com';

const auth: IdTokenVerifier = {
  async verifyIdToken(idToken) {
    if (idToken !== TEST_TOKEN) {
      throw new Error('invalid token');
    }
    return {
      uid: 'test-user',
      email: TEST_EMAIL,
      emailVerified: true,
      superadmin: true,
    };
  },
};

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('crag-api', () => {
  let replSet: MongoMemoryReplSet | undefined;
  let client: MongoClient | undefined;
  let db!: Db;
  let app!: ReturnType<typeof createApp>;
  const uploaded = new Map<string, Buffer>();
  const storage: ImageStorage = {
    async uploadImage(storagePath, data) {
      uploaded.set(storagePath, data);
    },
  };

  function write(target: Express = app) {
    const authorization = { Authorization: `Bearer ${TEST_TOKEN}` };
    return {
      get: (path: string) => request(target).get(path).set(authorization),
      // Older tests read a new crag with no token. Those crags are published after create.
      post: (path: string) => {
        const sent = request(target).post(path).set(authorization);
        if (path !== '/api/crags') return sent;
        return {
          send: async (body: object) => {
            const res = await sent.send(body);
            if (res.status === 201 && typeof res.body?.id === 'string') {
              await db.collection('crags').updateOne(
                { _id: res.body.id },
                { $set: { published: true } },
              );
            }
            return res;
          },
        };
      },
      put: (path: string) => request(target).put(path).set(authorization),
      patch: (path: string) => request(target).patch(path).set(authorization),
      delete: (path: string) => request(target).delete(path).set(authorization),
    };
  }

  function appFor(caller: AuthCaller, accounts?: AuthDirectory) {
    return createApp(db, {
      auth: {
        async verifyIdToken() {
          return caller;
        },
      },
      accounts,
    });
  }

  function listedMember(userId: string, role: 'owner' | 'admin') {
    return { userId, role, email: null, name: null };
  }

  function directoryFor(profiles: readonly AuthAccountProfile[]): AuthDirectory {
    return {
      async findByEmail(email) {
        return profiles.find((profile) => profile.email === email) ?? null;
      },
      async getByUids(uids) {
        const wanted = new Set(uids);
        return profiles.filter((profile) => wanted.has(profile.uid));
      },
    };
  }

  beforeAll(async () => {
    // Transactions require a replica set. A one-node set is enough.
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    client = new MongoClient(replSet.getUri());
    await client.connect();
    db = client.db('crag-api-test');
    await ensureIndexes(db);
    app = createApp(db, {
      storage,
      auth,
    });
  });

  afterAll(async () => {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error('Failed to close MongoDB test client:', error);
      }
    }
    if (replSet) {
      try {
        await replSet.stop();
      } catch (error) {
        console.error('Failed to stop MongoMemoryReplSet:', error);
      }
    }
  });

  beforeEach(async () => {
    await db.collection('crags').deleteMany({});
    await db.collection('sectors').deleteMany({});
    await db.collection('crag_members').deleteMany({});
    uploaded.clear();
  });

  it('returns an empty catalog from a fresh database', async () => {
    const res = await request(app).get('/api/crags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates an explorer crag via POST and assembles it on GET', async () => {
    const created = await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: 'roshka',
      cragName: 'Roshka',
      source: 'explorer',
      version: 1,
    });

    const catalog = await request(app).get('/api/crags');
    expect(catalog.body).toEqual([
      {
        id: 'roshka',
        cragName: 'Roshka',
        source: 'explorer',
        sectorCount: 0,
        published: true,
        version: 1,
        updatedAt: expect.any(String),
      },
    ]);
    expect(catalog.body[0].updatedAt).toBe(new Date(catalog.body[0].updatedAt).toISOString());

    const crag = await request(app).get('/api/crags/roshka');
    expect(crag.status).toBe(200);
    expect(crag.body.name).toBe('Roshka');
    expect(crag.body.id).toBe('roshka');
    expect(crag.body.cragId).toBeUndefined();
    expect(crag.body.sectors).toEqual([]);
    expect(crag.body.protocolVersion).toBe(CRAG_DATA_PROTOCOL);
    expect(crag.body.source).toBe('explorer');
    expect(crag.body.externalId).toBeUndefined();
  });

  it('counts sectors on the catalog and leaves an empty crag at zero', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await write().post('/api/crags').send({ name: 'Shulaveri', id: 'shulaveri' });
    const sector = await write().post('/api/crags/roshka/sectors').send({
      name: 'Cave',
      geo: { lat: 1, lon: 2 },
    });
    expect(sector.status).toBe(201);

    const catalog = await request(app).get('/api/crags');
    expect(catalog.status).toBe(200);
    expect(catalog.body).toEqual([
      expect.objectContaining({ id: 'roshka', sectorCount: 1, version: 1 }),
      expect.objectContaining({ id: 'shulaveri', sectorCount: 0, version: 1 }),
    ]);
  });

  it('rejects a duplicate crag id with 409', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const res = await write().post('/api/crags').send({ name: 'Other', id: 'roshka' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_exists');
  });

  it('requires an explicit lowercase id and rejects cragId', async () => {
    const missing = await write().post('/api/crags').send({ name: 'Roshka' });
    const uppercase = await write().post('/api/crags').send({ name: 'Roshka', id: 'Roshka' });
    const legacy = await write().post('/api/crags').send({ name: 'Roshka', cragId: 'roshka' });
    for (const res of [missing, uppercase, legacy]) {
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    }
    expect(await db.collection('crags').countDocuments()).toBe(0);
  });

  it('creates an external crag and keeps externalId off the response', async () => {
    const created = await write().post('/api/crags').send({
      id: 'roshka',
      name: 'Roshka',
      source: 'external',
      externalId: '35366',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: 'roshka',
      cragName: 'Roshka',
      source: 'external',
    });
    expect(created.body.externalId).toBeUndefined();
    const stored = await db.collection('crags').findOne({ _id: 'roshka' });
    expect(stored?.externalId).toBe('35366');
    expect(stored?.source).toBe('external');

    const explorer = await write().post('/api/crags').send({
      id: 'other',
      name: 'Other',
      externalId: '999',
    });
    expect(explorer.status).toBe(400);
    expect(explorer.body.error).toBe('invalid_request');

    const missingExternal = await write().post('/api/crags').send({
      id: 'cave',
      name: 'Cave',
      source: 'external',
    });
    expect(missingExternal.status).toBe(400);
    expect(missingExternal.body.error).toBe('invalid_request');
  });

  it('rejects a duplicate externalId with 409', async () => {
    await write().post('/api/crags').send({
      id: 'roshka',
      name: 'Roshka',
      source: 'external',
      externalId: '35366',
    });
    const res = await write().post('/api/crags').send({
      id: 'other',
      name: 'Other',
      source: 'external',
      externalId: '35366',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_exists');
    expect(res.body.message).toContain('externalId');
    expect(await db.collection('crags').countDocuments()).toBe(1);
  });

  it('patches crag-level fields and returns 409 on a stale version', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });

    const publishedOnContent = await write().patch('/api/crags/roshka').send({
      version: 1,
      published: true,
    });
    expect(publishedOnContent.status).toBe(400);
    expect(publishedOnContent.body.error).toBe('invalid_request');

    const stale = await write()
      .patch('/api/crags/roshka/settings')
      .send({ version: 99, name: 'Nope' });
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: 'version_conflict', currentVersion: 1 });

    const renamed = await write()
      .patch('/api/crags/roshka/settings')
      .send({ version: 1, name: 'Roshka Valley' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.version).toBe(2);
    expect(renamed.body.cragName).toBe('Roshka Valley');

    const patched = await write()
      .patch('/api/crags/roshka')
      .send({
        version: 2,
        description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
      });
    expect(patched.status).toBe(200);
    expect(patched.body.version).toBe(3);
    expect(patched.body.cragName).toBe('Roshka Valley');
    expect(patched.body.description).toEqual([
      { subheader: 'Access', paragraphs: ['Walk in.'] },
    ]);

    const catalog = await request(app).get('/api/crags');
    expect(catalog.body[0].cragName).toBe('Roshka Valley');
    expect(catalog.body[0].description).toBe('Walk in.');
  });

  it('puts a plain-text description excerpt on the catalog', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const patched = await write().patch('/api/crags/roshka').send({
      version: 1,
      description: [{
        subheader: 'Access',
        paragraphs: ['<p>Walk in from the <strong>parking</strong>.</p>', 'Second paragraph.'],
      }],
    });
    expect(patched.status).toBe(200);

    const catalog = await request(app).get('/api/crags');
    expect(catalog.body[0].description).toBe('Walk in from the parking.');
    expect(catalog.body[0].description).not.toContain('Second paragraph');
  });

  it('limits the catalog excerpt and keeps escaped comparisons', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const prefix = 'Walk 5 &lt; 10 minutes &amp; up. ';
    const plainPrefix = 'Walk 5 < 10 minutes & up. ';
    const filler = 'granite '.repeat(80);
    const plain = `${plainPrefix}${filler}`.trim();
    expect(plain.length).toBeGreaterThan(400);

    const patched = await write().patch('/api/crags/roshka').send({
      version: 1,
      description: [{
        subheader: 'Access',
        paragraphs: [
          '<p><br></p>',
          `<p>${prefix}${filler}</p>`,
          'Second paragraph stays off the catalog.',
        ],
      }],
    });
    expect(patched.status).toBe(200);

    const catalog = await request(app).get('/api/crags');
    expect(catalog.body[0].description).toBe(plain.slice(0, 400));
    expect(catalog.body[0].description).toHaveLength(400);
    expect(catalog.body[0].description.startsWith(plainPrefix.trim())).toBe(true);
    expect(catalog.body[0].description).not.toContain('Second paragraph');
  });

  it('adds, replaces, and deletes sectors without touching other documents', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });

    const created = await write()
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

    const replaced = await write()
      .put(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 1, name: 'Cave', geo: null });
    expect(replaced.status).toBe(200);
    expect(replaced.body.version).toBe(2);
    expect(replaced.body.name).toBe('Cave');

    const conflict = await write()
      .put(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 1, name: 'Old name', geo: null });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: 'version_conflict', currentVersion: 2 });

    const removed = await write().delete(`/api/crags/roshka/sectors/${sectorId}`);
    expect(removed.status).toBe(204);

    const afterDelete = await request(app).get('/api/crags/roshka');
    expect(afterDelete.body.sectors).toEqual([]);
    expect(afterDelete.body.version).toBe(1);
  });

  it('patches sector coordinates without replacing routes', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const created = await write()
      .post('/api/crags/roshka/sectors')
      .send({
        name: 'Main Wall',
        geo: { lat: 42.5, lon: 45.2 },
        routes: [{ name: 'Classic', grade: '6a' }],
      });
    expect(created.status).toBe(201);
    const sectorId = created.body.id as string;
    const routeId = created.body.routes[0].id as string;

    const patched = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 1, geo: { lat: 42.6, lon: 45.3 } });
    expect(patched.status).toBe(200);
    expect(patched.body.version).toBe(2);
    expect(patched.body.geo).toEqual({ lat: 42.6, lon: 45.3 });
    expect(patched.body.name).toBe('Main Wall');
    expect(patched.body.routes).toEqual([
      expect.objectContaining({ id: routeId, name: 'Classic', grade: '6a' }),
    ]);

    const conflict = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 1, geo: { lat: 1, lon: 2 } });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: 'version_conflict', currentVersion: 2 });

    const invalid = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 2, geo: { lat: 120, lon: 45.3 } });
    expect(invalid.status).toBe(400);

    const missing = await write()
      .patch('/api/crags/roshka/sectors/missing-sector')
      .send({ version: 1, geo: { lat: 1, lon: 2 } });
    expect(missing.status).toBe(404);

    const assembled = await request(app).get('/api/crags/roshka');
    expect(assembled.body.sectors[0].geo).toEqual({ lat: 42.6, lon: 45.3 });
    expect(assembled.body.sectors[0].routes[0].name).toBe('Classic');
  });

  it('renames a sector, updates route names, and rejects a duplicate', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const created = await write()
      .post('/api/crags/roshka/sectors')
      .send({
        name: 'Main Wall',
        geo: { lat: 42.5, lon: 45.2 },
        routes: [{ name: 'Classic', grade: '6a' }],
      });
    expect(created.status).toBe(201);
    const other = await write()
      .post('/api/crags/roshka/sectors')
      .send({ name: 'Cave', geo: { lat: 42.4, lon: 45.1 } });
    expect(other.status).toBe(201);

    const sectorId = created.body.id as string;
    const routeId = created.body.routes[0].id as string;
    const renamed = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 1, name: 'North Wall' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.version).toBe(2);
    expect(renamed.body.name).toBe('North Wall');
    expect(renamed.body.geo).toEqual({ lat: 42.5, lon: 45.2 });
    expect(renamed.body.routes).toEqual([
      expect.objectContaining({
        id: routeId,
        name: 'Classic',
        sectorName: 'North Wall',
      }),
    ]);

    const recased = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 2, name: 'north wall' });
    expect(recased.status).toBe(200);
    expect(recased.body.name).toBe('north wall');
    expect(recased.body.routes[0].sectorName).toBe('north wall');

    const duplicate = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 3, name: 'cave' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({
      error: 'already_exists',
      message: 'A sector with this name already exists.',
    });

    const versionOnly = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 3 });
    expect(versionOnly.status).toBe(400);

    const assembled = await request(app).get('/api/crags/roshka');
    const sector = assembled.body.sectors.find((item: { id: string }) => item.id === sectorId);
    expect(sector.name).toBe('north wall');
    expect(sector.routes[0].sectorName).toBe('north wall');
  });

  it('patches sector details and clears fields that are set to null', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const created = await write()
      .post('/api/crags/roshka/sectors')
      .send({
        name: 'Main Wall',
        geo: { lat: 42.5, lon: 45.2 },
        routes: [{ name: 'Classic', grade: '6a' }],
      });
    expect(created.status).toBe(201);
    const sectorId = created.body.id as string;
    const routeId = created.body.routes[0].id as string;

    const patched = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({
        version: 1,
        altitude: '2000m',
        approachTime: '30min',
        season: 'Apr; Jun; Aug - Oct',
        orientation: 'N, NW,',
        timeInSun: '08:00 - 11:00',
      });
    expect(patched.status).toBe(200);
    expect(patched.body).toEqual(expect.objectContaining({
      version: 2,
      name: 'Main Wall',
      altitude: '2000m',
      approachTime: '30min',
      season: 'Apr; Jun; Aug - Oct',
      orientation: 'N, NW,',
      timeInSun: '08:00 - 11:00',
      geo: { lat: 42.5, lon: 45.2 },
    }));
    expect(patched.body.routes).toEqual([
      expect.objectContaining({ id: routeId, name: 'Classic', sectorName: 'Main Wall' }),
    ]);

    const cleared = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 2, season: null, timeInSun: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.version).toBe(3);
    expect(cleared.body.season).toBeUndefined();
    expect(cleared.body.timeInSun).toBeUndefined();
    expect(cleared.body.altitude).toBe('2000m');
    expect(cleared.body.orientation).toBe('N, NW,');

    const blank = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({ version: 3, altitude: '   ' });
    expect(blank.status).toBe(400);

    const assembled = await request(app).get('/api/crags/roshka');
    const sector = assembled.body.sectors.find((item: { id: string }) => item.id === sectorId);
    expect(sector.season).toBeUndefined();
    expect(sector.altitude).toBe('2000m');
    expect(sector.routes[0].name).toBe('Classic');
  });

  it('replaces sector routes, assigns ids, and keeps a duplicate name', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const created = await write()
      .post('/api/crags/roshka/sectors')
      .send({
        name: 'Main Wall',
        routes: [{
          name: 'Classic',
          grade: '6a',
          rating: 2.5,
          ratingVotes: '10 votes',
          images: [{ imageFile: 'wall.jpg', routeIndex: 0 }],
          videos: [{ url: 'https://example.com/v', addedBy: 'Ada' }],
        }],
      });
    expect(created.status).toBe(201);
    const sectorId = created.body.id as string;
    const routeId = created.body.routes[0].id as string;

    const patched = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({
        version: 1,
        routes: [{
          id: routeId,
          name: 'Classic',
          grade: '6A+',
          height: 5,
          description: 'High start',
          tags: ['Crimpers'],
          rating: 2.5,
          ratingVotes: '10 votes',
          type: 'Boulder',
          sectorName: 'Somewhere',
          images: [{ imageFile: 'wall.jpg', routeIndex: 0 }],
          videos: [{ url: 'https://example.com/v', addedBy: 'Ada' }],
        }, {
          name: 'Direct',
          grade: '7A',
          height: 4.5,
          type: 'Sport',
        }],
      });
    expect(patched.status).toBe(200);
    expect(patched.body.version).toBe(2);
    expect(patched.body.routes[0]).toEqual(expect.objectContaining({
      id: routeId,
      name: 'Classic',
      grade: '6A+',
      height: 5,
      sectorName: 'Main Wall',
      description: 'High start',
      tags: ['Crimpers'],
      rating: 2.5,
      ratingVotes: '10 votes',
      type: 'Boulder',
      images: [{ imageFile: 'wall.jpg', routeIndex: 0 }],
      videos: [{ url: 'https://example.com/v', addedBy: 'Ada' }],
    }));
    expect(patched.body.routes[1]).toEqual(expect.objectContaining({
      name: 'Direct',
      grade: '7A',
      height: 4.5,
      type: 'Sport',
      sectorName: 'Main Wall',
    }));
    expect(patched.body.routes[1].id).toEqual(expect.any(String));
    expect(patched.body.routes[1].id).not.toBe(routeId);

    const renamed = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({
        version: 2,
        name: 'North Wall',
        routes: [{
          id: routeId,
          name: 'Classic',
          grade: '6A+',
          height: 5,
          images: [{ imageFile: 'wall.jpg', routeIndex: 0 }],
        }],
      });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('North Wall');
    expect(renamed.body.routes).toEqual([
      expect.objectContaining({ id: routeId, sectorName: 'North Wall', height: 5 }),
    ]);

    const invalidHeight = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({
        version: 3,
        routes: [{ name: 'Direct', grade: '6A', height: 0 }],
      });
    expect(invalidHeight.status).toBe(400);

    const duplicate = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({
        version: 3,
        routes: [
          { name: 'Direct', grade: '6A' },
          { name: 'direct', grade: '' },
        ],
      });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.routes.map((route: { name: string; grade: string }) => ({
      name: route.name,
      grade: route.grade,
    }))).toEqual([
      { name: 'Direct', grade: '6A' },
      { name: 'direct', grade: '' },
    ]);

    const assembled = await request(app).get('/api/crags/roshka');
    const sector = assembled.body.sectors.find((item: { id: string }) => item.id === sectorId);
    expect(sector.routes.map((route: { name: string; grade: string }) => ({
      name: route.name,
      grade: route.grade,
    }))).toEqual([
      { name: 'Direct', grade: '6A' },
      { name: 'direct', grade: '' },
    ]);
  });

  it('rejects a case-insensitive duplicate sector name on create and replace', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await write().post('/api/crags').send({ name: 'Other', id: 'other' });

    const created = await write()
      .post('/api/crags/roshka/sectors')
      .send({
        name: 'Main Wall',
        geo: { lat: 42.5, lon: 45.2 },
        routes: [{ name: 'Classic', grade: '6a', sectorName: 'Old' }],
      });
    expect(created.status).toBe(201);
    expect(created.body.nameKey).toBeUndefined();
    expect(created.body.routes[0].sectorName).toBe('Main Wall');
    const sectorId = created.body.id as string;
    const routeId = created.body.routes[0].id as string;

    const sameCrag = await write()
      .post('/api/crags/roshka/sectors')
      .send({ name: 'main wall', geo: { lat: 42.4, lon: 45.1 } });
    expect(sameCrag.status).toBe(409);
    expect(sameCrag.body).toEqual({
      error: 'already_exists',
      message: 'A sector with this name already exists.',
    });

    const otherCrag = await write()
      .post('/api/crags/other/sectors')
      .send({ name: 'Main Wall', geo: { lat: 1, lon: 2 } });
    expect(otherCrag.status).toBe(201);

    const cave = await write()
      .post('/api/crags/roshka/sectors')
      .send({
        name: 'Cave',
        geo: { lat: 42.4, lon: 45.1 },
        routes: [{ name: 'Dark', grade: '6b', sectorName: 'Somewhere' }],
      });
    expect(cave.status).toBe(201);
    const caveId = cave.body.id as string;

    const taken = await write()
      .put(`/api/crags/roshka/sectors/${caveId}`)
      .send({
        version: 1,
        name: 'MAIN WALL',
        geo: { lat: 42.4, lon: 45.1 },
        routes: [{ name: 'Dark', grade: '6b', sectorName: 'Cave' }],
      });
    expect(taken.status).toBe(409);
    expect(taken.body).toEqual({
      error: 'already_exists',
      message: 'A sector with this name already exists.',
    });

    const recased = await write()
      .put(`/api/crags/roshka/sectors/${caveId}`)
      .send({
        version: 1,
        name: 'cave',
        geo: { lat: 42.4, lon: 45.1 },
        routes: [{ name: 'Dark', grade: '6b', sectorName: 'Cave' }],
      });
    expect(recased.status).toBe(200);
    expect(recased.body.name).toBe('cave');
    expect(recased.body.routes[0].sectorName).toBe('cave');

    const renamed = await write()
      .put(`/api/crags/roshka/sectors/${sectorId}`)
      .send({
        version: 1,
        name: 'North Wall',
        geo: { lat: 42.5, lon: 45.2 },
        routes: [{ id: routeId, name: 'Classic', grade: '6a', sectorName: 'Main Wall' }],
      });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('North Wall');
    expect(renamed.body.routes[0]).toEqual(
      expect.objectContaining({ id: routeId, sectorName: 'North Wall' }),
    );
  });

  it('replaces topo images in display order', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const created = await write()
      .post('/api/crags/roshka/sectors')
      .send({
        name: 'Main Wall',
        routes: [{
          name: 'Classic',
          grade: '6a',
          images: [{
            imageFile: 'b.jpg',
            routeIndex: 0,
            line: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
          }],
        }],
        images: [
          { imageFile: 'a.jpg' },
          { imageFile: 'b.jpg' },
        ],
      });
    expect(created.status).toBe(201);
    const sectorId = created.body.id as string;

    const moved = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({
        version: 1,
        images: [
          { imageFile: 'b.jpg' },
          { imageFile: 'a.jpg' },
        ],
      });
    expect(moved.status).toBe(200);
    expect(moved.body.version).toBe(2);
    expect(moved.body.images).toEqual([
      { imageFile: 'b.jpg' },
      { imageFile: 'a.jpg' },
    ]);
    expect(moved.body.routes[0].images).toEqual([{
      imageFile: 'b.jpg',
      routeIndex: 0,
      line: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
    }]);

    const removed = await write()
      .patch(`/api/crags/roshka/sectors/${sectorId}`)
      .send({
        version: 2,
        images: [{ imageFile: 'a.jpg' }],
      });
    expect(removed.status).toBe(200);
    expect(removed.body.images).toEqual([{ imageFile: 'a.jpg' }]);
    expect(removed.body.routes[0]).toEqual({
      ...moved.body.routes[0],
      images: [],
    });
  });

  it('drops route links for a removed topo file and leaves the rest of the route', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const longVotes = 'Average rating 2.5 from 120 climbers';
    const route = {
      name: ' Classic ',
      grade: '6a ',
      sectorName: 'Main Wall',
      description: 'Steep',
      tags: ['Crimpers'],
      ratingVotes: longVotes,
      videos: [{ url: 'https://example.com/v', addedBy: '' }],
      images: [
        { imageFile: 'a.jpg', routeIndex: 0 },
        { imageFile: 'b.jpg', routeIndex: 1 },
      ],
    };
    await db.collection('sectors').insertOne({
      _id: 'wall-1',
      cragId: 'roshka',
      name: 'Main Wall',
      nameKey: 'main wall',
      geo: { lat: 42.5, lon: 45.2 },
      routes: [route, { ...route, name: 'Direct', images: [{ imageFile: 'b.jpg', routeIndex: 0 }] }],
      images: [
        { imageFile: 'a.jpg' },
        { imageFile: 'a.jpg' },
        { imageFile: 'b.jpg' },
      ],
      order: 0,
      version: 4,
      updatedAt: new Date(),
    });

    const keptDuplicate = await write()
      .patch('/api/crags/roshka/sectors/wall-1')
      .send({
        version: 4,
        images: [
          { imageFile: 'a.jpg' },
          { imageFile: 'b.jpg' },
        ],
      });
    expect(keptDuplicate.status).toBe(200);
    expect(keptDuplicate.body.routes[0]).toEqual(route);
    expect(keptDuplicate.body.routes[1].name).toBe('Direct');

    const removed = await write()
      .patch('/api/crags/roshka/sectors/wall-1')
      .send({
        version: 5,
        images: [{ imageFile: 'a.jpg' }],
      });
    expect(removed.status).toBe(200);
    expect(removed.body.routes[0]).toEqual({
      ...route,
      images: [{ imageFile: 'a.jpg', routeIndex: 0 }],
    });
    expect(removed.body.routes[0].id).toBeUndefined();
    expect(removed.body.routes[1]).toEqual({
      ...route,
      name: 'Direct',
      images: [],
    });
  });

  it('keeps one sector when two creates race for the same name', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const [first, second] = await Promise.all([
      write().post('/api/crags/roshka/sectors').send({ name: 'Cave', geo: { lat: 1, lon: 2 } }),
      write().post('/api/crags/roshka/sectors').send({ name: 'cave', geo: { lat: 3, lon: 4 } }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const rejected = first.status === 409 ? first : second;
    expect(rejected.body).toEqual({
      error: 'already_exists',
      message: 'A sector with this name already exists.',
    });

    const assembled = await request(app).get('/api/crags/roshka');
    expect(assembled.body.sectors).toHaveLength(1);
  });

  it('rejects sector writes on an extracted crag', async () => {
    await db.collection('crags').insertOne({
      _id: 'roshka',
      name: 'Roshka',
      source: 'external',
      protocolVersion: 1,
      description: [],
      trails: [],
      markers: [],
      externalId: 'roshka-35366',
      version: 1,
      updatedAt: new Date(),
    });
    await db.collection('sectors').insertOne({
      _id: 'cave-1',
      cragId: 'roshka',
      name: 'Cave',
      geo: { lat: 44.1, lon: 6.2 },
      routes: [{
        id: 'route-1',
        externalId: '88421',
        name: 'Classic',
        grade: '6a',
        sectorName: 'Cave',
        description: '',
        tags: [],
        images: [],
      }],
      images: [],
      order: 0,
      externalId: 'cave-1',
      version: 3,
      updatedAt: new Date(),
    });

    const created = await write().post('/api/crags/roshka/sectors').send({
      name: 'New',
      geo: { lat: 44.2, lon: 6.3 },
    });
    expect(created.status).toBe(403);
    expect(created.body).toEqual({
      error: 'read_only',
      message: 'An extracted crag is read-only',
    });

    const replaced = await write().put('/api/crags/roshka/sectors/cave-1').send({
      version: 3,
      name: 'Renamed',
      geo: { lat: 44.1, lon: 6.2 },
    });
    expect(replaced.status).toBe(403);
    expect(replaced.body.error).toBe('read_only');

    const removed = await write().delete('/api/crags/roshka/sectors/cave-1');
    expect(removed.status).toBe(403);
    expect(removed.body.error).toBe('read_only');

    const patched = await write().patch('/api/crags/roshka/sectors/cave-1').send({
      version: 3,
      geo: { lat: 44.2, lon: 6.3 },
    });
    expect(patched.status).toBe(403);
    expect(patched.body.error).toBe('read_only');

    const cragPatch = await write().patch('/api/crags/roshka').send({
      version: 1,
      markers: [{ type: 'parking_space', info: 'Lot', geo: { lat: 44, lon: 6 } }],
    });
    expect(cragPatch.status).toBe(403);
    expect(cragPatch.body).toEqual({
      error: 'read_only',
      message: 'An extracted crag is read-only',
    });

    const renamed = await write().patch('/api/crags/roshka/settings').send({
      version: 1,
      name: 'Renamed',
    });
    expect(renamed.status).toBe(403);
    expect(renamed.body.error).toBe('read_only');

    const assembled = await request(app).get('/api/crags/roshka');
    expect(assembled.status).toBe(200);
    expect(assembled.body.name).toBe('Roshka');
    expect(assembled.body.version).toBe(1);
    expect(assembled.body.markers).toEqual([]);
    expect(assembled.body.externalId).toBeUndefined();
    expect(assembled.body.sectors).toMatchObject([{ id: 'cave-1', name: 'Cave', version: 3 }]);
    expect(assembled.body.sectors[0].externalId).toBeUndefined();
    expect(assembled.body.sectors[0].routes[0]).toMatchObject({
      id: 'route-1',
      name: 'Classic',
    });
    expect(assembled.body.sectors[0].routes[0].externalId).toBeUndefined();

    const catalog = await request(app).get('/api/crags');
    expect(catalog.body).toEqual([
      {
        id: 'roshka',
        cragName: 'Roshka',
        source: 'external',
        sectorCount: 1,
        published: true,
        version: 1,
        updatedAt: expect.any(String),
      },
    ]);
  });

  it('stores one membership per crag and user', async () => {
    const members = db.collection('crag_members');
    await members.insertOne({ cragId: 'roshka', userId: 'user-a', role: 'owner' });
    await members.insertOne({ cragId: 'roshka', userId: 'user-b', role: 'admin' });
    await expect(
      members.insertOne({ cragId: 'roshka', userId: 'user-a', role: 'admin' }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it.each(['owner', 'admin'] as const)(
    'lets a crag %s edit an explorer crag',
    async (role) => {
      await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
      await db.collection('crag_members').insertOne({
        cragId: 'roshka',
        userId: 'member-user',
        role,
      });
      const memberApp = appFor({
        uid: 'member-user',
        email: 'member@example.com',
        emailVerified: true,
        superadmin: false,
      });
      const res = await request(memberApp)
        .patch('/api/crags/roshka')
        .set('Authorization', 'Bearer member-token')
        .send({
          version: 1,
          description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
          trails: [{ name: 'Approach', color: '#fff', points: [{ lat: 1, lon: 2 }] }],
          markers: [{ type: 'parking_space', info: 'Lot', geo: { lat: 1, lon: 2 } }],
        });
      expect(res.status).toBe(200);
      expect(res.body.cragName).toBe('Roshka');
      expect(res.body.description).toEqual([
        { subheader: 'Access', paragraphs: ['Walk in.'] },
      ]);
      expect(res.body.trails).toEqual([
        { name: 'Approach', color: '#fff', points: [{ lat: 1, lon: 2 }] },
      ]);
      expect(res.body.markers).toEqual([
        { type: 'parking_space', info: 'Lot', geo: { lat: 1, lon: 2 } },
      ]);
    },
  );

  it.each(['owner', 'admin'] as const)(
    'rejects a crag %s changing the name or published flag',
    async (role) => {
      await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
      await db.collection('crag_members').insertOne({
        cragId: 'roshka',
        userId: 'member-user',
        role,
      });
      const memberApp = appFor({
        uid: 'member-user',
        email: 'member@example.com',
        emailVerified: true,
        superadmin: false,
      });
      const renamed = await request(memberApp)
        .patch('/api/crags/roshka/settings')
        .set('Authorization', 'Bearer member-token')
        .send({ version: 1, name: 'Roshka Valley' });
      expect(renamed.status).toBe(403);
      expect(renamed.body).toEqual({ error: 'forbidden' });

      const published = await request(memberApp)
        .patch('/api/crags/roshka/settings')
        .set('Authorization', 'Bearer member-token')
        .send({ version: 1, published: true });
      expect(published.status).toBe(403);
      expect(published.body).toEqual({ error: 'forbidden' });

      const mixed = await request(memberApp)
        .patch('/api/crags/roshka')
        .set('Authorization', 'Bearer member-token')
        .send({
          version: 1,
          name: 'Roshka Valley',
          description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
        });
      expect(mixed.status).toBe(400);
      expect(mixed.body.error).toBe('invalid_request');

      const stored = await db.collection('crags').findOne({ _id: 'roshka' });
      expect(stored?.name).toBe('Roshka');
      expect(stored?.version).toBe(1);
      expect(stored?.description).toEqual([]);
    },
  );

  it('rejects a patch that includes opentopoTilePack', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const res = await write()
      .patch('/api/crags/roshka/settings')
      .send({ version: 1, name: 'Roshka Valley', opentopoTilePack: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    const stored = await db.collection('crags').findOne({ _id: 'roshka' });
    expect(stored?.name).toBe('Roshka');
    expect(stored?.version).toBe(1);
  });

  it('rejects an explorer edit from a signed-in user with no membership', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const stranger = appFor({
      uid: 'stranger',
      email: 'stranger@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const res = await request(stranger)
      .patch('/api/crags/roshka')
      .set('Authorization', 'Bearer stranger-token')
      .send({
        version: 1,
        description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
      });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('rejects an explorer edit when the membership is for another crag', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('crag_members').insertOne({
      cragId: 'other',
      userId: 'member-user',
      role: 'admin',
    });
    const memberApp = appFor({
      uid: 'member-user',
      email: 'member@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const res = await request(memberApp)
      .patch('/api/crags/roshka')
      .set('Authorization', 'Bearer member-token')
      .send({
        version: 1,
        description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
      });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('lets only a superadmin create a crag and does not insert an owner', async () => {
    const created = await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    expect(created.status).toBe(201);
    expect(await db.collection('crag_members').countDocuments({ cragId: 'roshka' })).toBe(0);

    await db.collection('crag_members').insertOne({
      cragId: 'roshka',
      userId: 'owner-user',
      role: 'owner',
    });
    const ownerApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const rejected = await request(ownerApp)
      .post('/api/crags')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Other', id: 'other' });
    expect(rejected.status).toBe(403);
    expect(rejected.body).toEqual({ error: 'forbidden' });

    const catalog = await request(app).get('/api/crags');
    expect(catalog.body).toEqual([
      {
        id: 'roshka',
        cragName: 'Roshka',
        source: 'explorer',
        sectorCount: 0,
        published: true,
        version: 1,
        updatedAt: expect.any(String),
      },
    ]);
  });

  it.each(['owner', 'admin'] as const)(
    'lets a crag %s upload an image',
    async (role) => {
      await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
      await db.collection('crag_members').insertOne({
        cragId: 'roshka',
        userId: 'member-user',
        role,
      });
      const memberApp = createApp(db, {
        storage,
        auth: {
          async verifyIdToken() {
            return {
              uid: 'member-user',
              email: 'member@example.com',
              emailVerified: true,
              superadmin: false,
            };
          },
        },
      });
      const res = await request(memberApp)
        .post('/api/crags/roshka/images')
        .set('Authorization', 'Bearer member-token')
        .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(201);
      expect(res.body.storagePath).toBe(`crags/roshka/topo-images/${res.body.imageFile}`);
    },
  );

  it('rejects an image upload from a signed-in user with no membership', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    uploaded.clear();
    const stranger = appFor({
      uid: 'stranger',
      email: 'stranger@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const res = await request(stranger)
      .post('/api/crags/roshka/images')
      .set('Authorization', 'Bearer stranger-token')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
    expect(uploaded.size).toBe(0);
  });

  it('keeps image upload read-only on an extracted crag', async () => {
    await db.collection('crags').insertOne({
      _id: 'roshka',
      name: 'Roshka',
      source: 'external',
      protocolVersion: 1,
      description: [],
      trails: [],
      markers: [],
      version: 1,
      updatedAt: new Date(),
    });
    const res = await write()
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'read_only',
      message: 'An extracted crag is read-only',
    });
    expect(uploaded.size).toBe(0);
  });

  it('keeps an extracted crag read-only for its owner', async () => {
    await db.collection('crags').insertOne({
      _id: 'roshka',
      name: 'Roshka',
      source: 'external',
      protocolVersion: 1,
      description: [],
      trails: [],
      markers: [],
      version: 1,
      updatedAt: new Date(),
    });
    await db.collection('crag_members').insertOne({
      cragId: 'roshka',
      userId: 'owner-user',
      role: 'owner',
    });
    const ownerApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const res = await request(ownerApp)
      .patch('/api/crags/roshka')
      .set('Authorization', 'Bearer owner-token')
      .send({
        version: 1,
        description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
      });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'read_only',
      message: 'An extracted crag is read-only',
    });
  });

  it('lets a superadmin grant owners and admins and remove the last owner', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('crag_members').insertOne({
      cragId: 'other',
      userId: 'elsewhere',
      role: 'owner',
    });

    const empty = await write().get('/api/crags/roshka/members');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const owner = await write().put('/api/crags/roshka/members/owner-a').send({ role: 'owner' });
    expect(owner.status).toBe(200);
    expect(owner.body).toEqual({ userId: 'owner-a', role: 'owner' });

    const secondOwner = await write()
      .put('/api/crags/roshka/members/owner-b')
      .send({ role: 'owner' });
    expect(secondOwner.status).toBe(200);
    expect(secondOwner.body).toEqual({ userId: 'owner-b', role: 'owner' });

    const admin = await write().put('/api/crags/roshka/members/admin-user').send({ role: 'admin' });
    expect(admin.status).toBe(200);
    expect(admin.body).toEqual({ userId: 'admin-user', role: 'admin' });

    const demoted = await write().put('/api/crags/roshka/members/owner-a').send({ role: 'admin' });
    expect(demoted.status).toBe(200);
    expect(demoted.body).toEqual({ userId: 'owner-a', role: 'admin' });
    expect(await db.collection('crag_members').countDocuments({ cragId: 'roshka', userId: 'owner-a' })).toBe(1);

    const listed = await write().get('/api/crags/roshka/members');
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      listedMember('admin-user', 'admin'),
      listedMember('owner-a', 'admin'),
      listedMember('owner-b', 'owner'),
    ]);

    const removedAdmin = await write().delete('/api/crags/roshka/members/admin-user');
    expect(removedAdmin.status).toBe(204);
    const removedOwner = await write().delete('/api/crags/roshka/members/owner-b');
    expect(removedOwner.status).toBe(204);
    const removedLast = await write().delete('/api/crags/roshka/members/owner-a');
    expect(removedLast.status).toBe(204);

    const after = await write().get('/api/crags/roshka/members');
    expect(after.status).toBe(200);
    expect(after.body).toEqual([]);
    expect(await db.collection('crag_members').countDocuments({ cragId: 'other' })).toBe(1);

    const missing = await write().delete('/api/crags/roshka/members/owner-a');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'not_found', message: 'member not found' });
  });

  it('lets an owner grant and remove admins but not owners', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('crag_members').insertMany([
      { cragId: 'roshka', userId: 'owner-user', role: 'owner' },
      { cragId: 'roshka', userId: 'other-owner', role: 'owner' },
      { cragId: 'roshka', userId: 'admin-user', role: 'admin' },
    ]);
    const ownerApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const authz = { Authorization: 'Bearer owner-token' };

    const listed = await request(ownerApp).get('/api/crags/roshka/members').set(authz);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      listedMember('admin-user', 'admin'),
      listedMember('other-owner', 'owner'),
      listedMember('owner-user', 'owner'),
    ]);

    const granted = await request(ownerApp)
      .put('/api/crags/roshka/members/new-admin')
      .set(authz)
      .send({ role: 'admin' });
    expect(granted.status).toBe(200);
    expect(granted.body).toEqual({ userId: 'new-admin', role: 'admin' });

    const refreshed = await request(ownerApp)
      .put('/api/crags/roshka/members/admin-user')
      .set(authz)
      .send({ role: 'admin' });
    expect(refreshed.status).toBe(200);

    const promote = await request(ownerApp)
      .put('/api/crags/roshka/members/new-owner')
      .set(authz)
      .send({ role: 'owner' });
    expect(promote.status).toBe(403);
    expect(promote.body).toEqual({ error: 'forbidden' });

    const demoteOther = await request(ownerApp)
      .put('/api/crags/roshka/members/other-owner')
      .set(authz)
      .send({ role: 'admin' });
    expect(demoteOther.status).toBe(403);
    expect(demoteOther.body).toEqual({ error: 'forbidden' });

    const demoteSelf = await request(ownerApp)
      .put('/api/crags/roshka/members/owner-user')
      .set(authz)
      .send({ role: 'admin' });
    expect(demoteSelf.status).toBe(403);
    expect(demoteSelf.body).toEqual({ error: 'forbidden' });

    const removeOwner = await request(ownerApp).delete('/api/crags/roshka/members/other-owner').set(authz);
    expect(removeOwner.status).toBe(403);
    expect(removeOwner.body).toEqual({ error: 'forbidden' });

    const removeSelf = await request(ownerApp).delete('/api/crags/roshka/members/owner-user').set(authz);
    expect(removeSelf.status).toBe(403);
    expect(removeSelf.body).toEqual({ error: 'forbidden' });

    const removeAdmin = await request(ownerApp).delete('/api/crags/roshka/members/admin-user').set(authz);
    expect(removeAdmin.status).toBe(204);

    const stored = await db.collection('crag_members').find({ cragId: 'roshka' }).sort({ userId: 1 }).toArray();
    expect(stored.map((member) => ({ userId: member.userId, role: member.role }))).toEqual([
      { userId: 'new-admin', role: 'admin' },
      { userId: 'other-owner', role: 'owner' },
      { userId: 'owner-user', role: 'owner' },
    ]);
  });

  it('lets an admin list members but not change them', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('crag_members').insertMany([
      { cragId: 'roshka', userId: 'owner-user', role: 'owner' },
      { cragId: 'roshka', userId: 'admin-user', role: 'admin' },
    ]);
    const adminApp = appFor({
      uid: 'admin-user',
      email: 'admin@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const authz = { Authorization: 'Bearer admin-token' };
    const before = await db.collection('crag_members').countDocuments({ cragId: 'roshka' });

    const listed = await request(adminApp).get('/api/crags/roshka/members').set(authz);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      listedMember('admin-user', 'admin'),
      listedMember('owner-user', 'owner'),
    ]);

    const granted = await request(adminApp)
      .put('/api/crags/roshka/members/new-admin')
      .set(authz)
      .send({ role: 'admin' });
    expect(granted.status).toBe(403);
    expect(granted.body).toEqual({ error: 'forbidden' });

    const removed = await request(adminApp).delete('/api/crags/roshka/members/owner-user').set(authz);
    expect(removed.status).toBe(403);
    expect(removed.body).toEqual({ error: 'forbidden' });

    const lookup = await request(adminApp)
      .get('/api/crags/roshka/accounts')
      .query({ email: 'owner@example.com' })
      .set(authz);
    expect(lookup.status).toBe(403);
    expect(lookup.body).toEqual({ error: 'forbidden' });

    expect(await db.collection('crag_members').countDocuments({ cragId: 'roshka' })).toBe(before);
  });

  it('rejects membership routes from a signed-in user with no membership', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('crag_members').insertOne({
      cragId: 'roshka',
      userId: 'owner-user',
      role: 'owner',
    });
    const callerApp = appFor({
      uid: 'stranger',
      email: 'stranger@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const authz = { Authorization: 'Bearer stranger-token' };
    const before = await db.collection('crag_members').countDocuments({ cragId: 'roshka' });

    const listed = await request(callerApp).get('/api/crags/roshka/members').set(authz);
    expect(listed.status).toBe(403);
    expect(listed.body).toEqual({ error: 'forbidden' });

    const granted = await request(callerApp)
      .put('/api/crags/roshka/members/new-admin')
      .set(authz)
      .send({ role: 'admin' });
    expect(granted.status).toBe(403);
    expect(granted.body).toEqual({ error: 'forbidden' });

    const removed = await request(callerApp).delete('/api/crags/roshka/members/owner-user').set(authz);
    expect(removed.status).toBe(403);
    expect(removed.body).toEqual({ error: 'forbidden' });

    const missing = await request(callerApp).delete('/api/crags/roshka/members/missing-user').set(authz);
    expect(missing.status).toBe(403);
    expect(missing.body).toEqual({ error: 'forbidden' });

    expect(await db.collection('crag_members').countDocuments({ cragId: 'roshka' })).toBe(before);
  });

  it('fills member names and emails from the Auth directory', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('crag_members').insertMany([
      { cragId: 'roshka', userId: 'known-user', role: 'admin' },
      { cragId: 'roshka', userId: 'missing-user', role: 'owner' },
    ]);
    const directory = directoryFor([
      {
        uid: 'known-user',
        email: 'known@example.com',
        emailVerified: true,
        name: 'Known Climber',
      },
    ]);
    const callerApp = appFor({
      uid: 'test-user',
      email: TEST_EMAIL,
      emailVerified: true,
      superadmin: true,
    }, directory);

    const listed = await request(callerApp)
      .get('/api/crags/roshka/members')
      .set('Authorization', 'Bearer test-token');
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      { userId: 'known-user', role: 'admin', email: 'known@example.com', name: 'Known Climber' },
      { userId: 'missing-user', role: 'owner', email: null, name: null },
    ]);
  });

  it('looks up a verified account by email and hides missing or unverified accounts', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const directory = directoryFor([
      {
        uid: 'verified-user',
        email: 'verified@example.com',
        emailVerified: true,
        name: 'Verified User',
      },
      {
        uid: 'pending-user',
        email: 'pending@example.com',
        emailVerified: false,
        name: 'Pending User',
      },
    ]);
    const ownerApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    }, directory);
    await db.collection('crag_members').insertOne({
      cragId: 'roshka',
      userId: 'owner-user',
      role: 'owner',
    });
    const authz = { Authorization: 'Bearer owner-token' };
    const missingMessage = { error: 'not_found', message: 'No verified account uses that email' };

    const found = await request(ownerApp)
      .get('/api/crags/roshka/accounts')
      .query({ email: '  Verified@Example.com ' })
      .set(authz);
    expect(found.status).toBe(200);
    expect(found.body).toEqual({
      uid: 'verified-user',
      email: 'verified@example.com',
      name: 'Verified User',
    });

    const pending = await request(ownerApp)
      .get('/api/crags/roshka/accounts')
      .query({ email: 'pending@example.com' })
      .set(authz);
    expect(pending.status).toBe(404);
    expect(pending.body).toEqual(missingMessage);

    const unknown = await request(ownerApp)
      .get('/api/crags/roshka/accounts')
      .query({ email: 'missing@example.com' })
      .set(authz);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual(missingMessage);

    const invalid = await request(ownerApp)
      .get('/api/crags/roshka/accounts')
      .query({ email: 'not-an-email' })
      .set(authz);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe('invalid_request');

    const otherOwner = appFor({
      uid: 'other-owner',
      email: 'other@example.com',
      emailVerified: true,
      superadmin: false,
    }, directory);
    await db.collection('crag_members').insertOne({
      cragId: 'other',
      userId: 'other-owner',
      role: 'owner',
    });
    const otherCrag = await request(otherOwner)
      .get('/api/crags/roshka/accounts')
      .query({ email: 'verified@example.com' })
      .set('Authorization', 'Bearer other-token');
    expect(otherCrag.status).toBe(403);
    expect(otherCrag.body).toEqual({ error: 'forbidden' });

    const unconfigured = await write().get('/api/crags/roshka/accounts').query({ email: 'verified@example.com' });
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.body.error).toBe('accounts_unavailable');

    const failing: AuthDirectory = {
      async findByEmail() {
        throw new Error('auth down');
      },
      async getByUids() {
        throw new Error('auth down');
      },
    };
    const failingApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    }, failing);
    const failedLookup = await request(failingApp)
      .get('/api/crags/roshka/accounts')
      .query({ email: 'verified@example.com' })
      .set(authz);
    expect(failedLookup.status).toBe(502);
    expect(failedLookup.body.error).toBe('accounts_failed');

    const failedList = await request(failingApp)
      .get('/api/crags/roshka/members')
      .set(authz);
    expect(failedList.status).toBe(502);
    expect(failedList.body.error).toBe('accounts_failed');
  });

  it('rejects membership routes when the caller owns a different crag', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('crag_members').insertOne({
      cragId: 'other',
      userId: 'owner-user',
      role: 'owner',
    });
    const ownerApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const res = await request(ownerApp)
      .get('/api/crags/roshka/members')
      .set('Authorization', 'Bearer owner-token');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('keeps membership routes read-only on an extracted crag', async () => {
    await db.collection('crags').insertOne({
      _id: 'roshka',
      name: 'Roshka',
      source: 'external',
      protocolVersion: 1,
      description: [],
      trails: [],
      markers: [],
      version: 1,
      updatedAt: new Date(),
    });
    await db.collection('crag_members').insertOne({
      cragId: 'roshka',
      userId: 'owner-user',
      role: 'owner',
    });
    const readOnlyBody = {
      error: 'read_only',
      message: 'An extracted crag is read-only',
    };

    const listed = await write().get('/api/crags/roshka/members');
    expect(listed.status).toBe(403);
    expect(listed.body).toEqual(readOnlyBody);

    const lookup = await write().get('/api/crags/roshka/accounts').query({ email: 'owner@example.com' });
    expect(lookup.status).toBe(403);
    expect(lookup.body).toEqual(readOnlyBody);

    const granted = await write().put('/api/crags/roshka/members/owner-a').send({ role: 'owner' });
    expect(granted.status).toBe(403);
    expect(granted.body).toEqual(readOnlyBody);

    const removed = await write().delete('/api/crags/roshka/members/owner-user');
    expect(removed.status).toBe(403);
    expect(removed.body).toEqual(readOnlyBody);

    const ownerApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const ownerList = await request(ownerApp)
      .get('/api/crags/roshka/members')
      .set('Authorization', 'Bearer owner-token');
    expect(ownerList.status).toBe(403);
    expect(ownerList.body).toEqual(readOnlyBody);

    expect(await db.collection('crag_members').countDocuments()).toBe(1);
  });

  it('returns 404 for membership routes when the crag is missing', async () => {
    const listed = await write().get('/api/crags/missing/members');
    expect(listed.status).toBe(404);
    expect(listed.body).toEqual({ error: 'not_found', message: 'crag not found' });

    const lookup = await write().get('/api/crags/missing/accounts').query({ email: 'a@b.co' });
    expect(lookup.status).toBe(404);
    expect(lookup.body).toEqual({ error: 'not_found', message: 'crag not found' });

    const granted = await write().put('/api/crags/missing/members/user-a').send({ role: 'admin' });
    expect(granted.status).toBe(404);
    expect(granted.body).toEqual({ error: 'not_found', message: 'crag not found' });

    const removed = await write().delete('/api/crags/missing/members/user-a');
    expect(removed.status).toBe(404);
    expect(removed.body).toEqual({ error: 'not_found', message: 'crag not found' });
    expect(await db.collection('crag_members').countDocuments()).toBe(0);
  });

  it('returns the caller memberships at sign-in', async () => {
    await db.collection('crag_members').insertMany([
      { cragId: 'roshka', userId: 'owner-user', role: 'owner' },
      { cragId: 'other', userId: 'owner-user', role: 'owner' },
      { cragId: 'roshka', userId: 'admin-user', role: 'admin' },
    ]);

    const anonymous = await request(app).get('/api/me/memberships');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ error: 'unauthorized' });

    const strangerApp = appFor({
      uid: 'stranger',
      email: 'stranger@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const stranger = await request(strangerApp)
      .get('/api/me/memberships')
      .set('Authorization', 'Bearer stranger-token');
    expect(stranger.status).toBe(200);
    expect(stranger.body).toEqual({ memberships: [] });

    const ownerApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const owner = await request(ownerApp)
      .get('/api/me/memberships')
      .set('Authorization', 'Bearer owner-token');
    expect(owner.status).toBe(200);
    expect(owner.body).toEqual({
      memberships: [
        { cragId: 'other', role: 'owner' },
        { cragId: 'roshka', role: 'owner' },
      ],
    });

    const adminApp = appFor({
      uid: 'admin-user',
      email: 'admin@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const admin = await request(adminApp)
      .get('/api/me/memberships')
      .set('Authorization', 'Bearer admin-token');
    expect(admin.status).toBe(200);
    expect(admin.body).toEqual({
      memberships: [{ cragId: 'roshka', role: 'admin' }],
    });
  });

  it('rejects a membership role other than owner or admin', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const res = await write().put('/api/crags/roshka/members/user-a').send({ role: 'editor' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(await db.collection('crag_members').countDocuments()).toBe(0);
  });

  it('keeps a route external id in storage and omits it from the response', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('sectors').insertOne({
      _id: 'wall-1',
      cragId: 'roshka',
      name: 'Main Wall',
      nameKey: 'main wall',
      geo: null,
      routes: [{
        id: 'route-1',
        externalId: '88421',
        name: 'Classic',
        grade: '6a',
        sectorName: 'Main Wall',
        description: '',
        tags: [],
        images: [],
      }],
      images: [],
      order: 0,
      version: 1,
      updatedAt: new Date(),
    });

    const patched = await write().patch('/api/crags/roshka/sectors/wall-1').send({
      version: 1,
      routes: [{ id: 'route-1', name: 'Direct', grade: '7a' }],
    });
    expect(patched.status).toBe(200);
    expect(patched.body.routes[0]).toMatchObject({
      id: 'route-1',
      name: 'Direct',
      grade: '7a',
    });
    expect(patched.body.routes[0].externalId).toBeUndefined();

    const stored = await db.collection('sectors').findOne({ _id: 'wall-1' });
    expect(stored?.routes?.[0]).toMatchObject({
      id: 'route-1',
      externalId: '88421',
      name: 'Direct',
    });
  });

  it('returns 404 for a missing crag or sector', async () => {
    const missingCrag = await request(app).get('/api/crags/missing');
    expect(missingCrag.status).toBe(404);

    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    const missingSector = await write().delete(
      '/api/crags/roshka/sectors/00000000-0000-0000-0000-000000000000',
    );
    expect(missingSector.status).toBe(404);
  });

  it('keeps explorer sectors in insert order across delete and GPX', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    for (const name of ['Sector 10', 'Cave', 'Sector 2']) {
      const created = await write().post('/api/crags/roshka/sectors').send({
        name,
        geo: { lat: 44.1, lon: 6.2 },
      });
      expect(created.status).toBe(201);
      expect(created.body.order).toBeUndefined();
    }

    const assembled = await request(app).get('/api/crags/roshka');
    expect(assembled.body.sectors.map((sector: { name: string }) => sector.name)).toEqual([
      'Sector 10',
      'Cave',
      'Sector 2',
    ]);
    expect(assembled.body.sectors[0].order).toBeUndefined();

    const gpx = await request(app).get('/api/crags/roshka/gpx');
    expect(gpx.status).toBe(200);
    const waypointNames = [...gpx.text.matchAll(/<wpt\b[^>]*>[\s\S]*?<name>([^<]*)<\/name>/g)].map(
      (match) => match[1],
    );
    expect(waypointNames).toEqual(['Sector 10', 'Cave', 'Sector 2']);

    const cave = assembled.body.sectors[1];
    const renamed = await write().put(`/api/crags/roshka/sectors/${cave.id}`).send({
      version: cave.version,
      name: 'Zebra',
      geo: { lat: 44.1, lon: 6.2 },
    });
    expect(renamed.status).toBe(200);
    const afterRename = await request(app).get('/api/crags/roshka');
    expect(afterRename.body.sectors.map((sector: { name: string }) => sector.name)).toEqual([
      'Sector 10',
      'Zebra',
      'Sector 2',
    ]);

    const removed = await write().delete(`/api/crags/roshka/sectors/${cave.id}`);
    expect(removed.status).toBe(204);
    const added = await write().post('/api/crags/roshka/sectors').send({
      name: 'Alpha',
      geo: { lat: 44.2, lon: 6.3 },
    });
    expect(added.status).toBe(201);

    const after = await request(app).get('/api/crags/roshka');
    expect(after.body.sectors.map((sector: { name: string }) => sector.name)).toEqual([
      'Sector 10',
      'Sector 2',
      'Alpha',
    ]);
  });

  it('builds GPX from the current database state without writing to Storage', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await write().post('/api/crags/roshka/sectors').send({
      name: 'Cave',
      geo: { lat: 44.1, lon: 6.2 },
    });
    await write()
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

  it('uploads an image to Storage as crags/{cragId}/topo-images/{hash}.ext', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });

    const res = await write()
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.jpg', contentType: 'image/jpeg' });

    const hash = createHash('sha256').update(PNG_1X1).digest('hex');
    const imageFile = `${hash}.png`;
    const storagePath = `crags/roshka/topo-images/${imageFile}`;
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ imageFile, storagePath });
    expect(uploaded.get(storagePath)?.equals(PNG_1X1)).toBe(true);

    const missingCrag = await write()
      .post('/api/crags/missing/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.png', contentType: 'image/png' });
    expect(missingCrag.status).toBe(404);

    const notImage = await write()
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, Buffer.from('hello'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    expect(notImage.status).toBe(400);
  });

  it('returns 503 when image storage is not configured and 502 when upload fails', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });

    const noStorageApp = createApp(db, { auth });
    const unavailable = await write(noStorageApp)
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.png', contentType: 'image/png' });
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error).toBe('storage_unavailable');

    const failing: ImageStorage = {
      async uploadImage() {
        throw new Error('emulator down');
      },
    };
    const failingApp = createApp(db, { storage: failing, auth });
    const failed = await write(failingApp)
      .post('/api/crags/roshka/images')
      .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'wall.png', contentType: 'image/png' });
    expect(failed.status).toBe(502);
    expect(failed.body.error).toBe('storage_failed');
  });

  it('lets only a superadmin delete an empty crag', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('crag_members').insertOne({
      cragId: 'roshka',
      userId: 'owner-user',
      role: 'owner',
    });
    const ownerApp = appFor({
      uid: 'owner-user',
      email: 'owner@example.com',
      emailVerified: true,
      superadmin: false,
    });
    const rejected = await request(ownerApp)
      .delete('/api/crags/roshka')
      .set('Authorization', 'Bearer owner-token');
    expect(rejected.status).toBe(403);
    expect(rejected.body).toEqual({ error: 'forbidden' });

    const deleted = await write().delete('/api/crags/roshka');
    expect(deleted.status).toBe(204);
    expect(await db.collection('crags').findOne({ _id: 'roshka' })).toBeNull();
    expect(await db.collection('crag_members').countDocuments({ cragId: 'roshka' })).toBe(0);

    const missing = await write().delete('/api/crags/roshka');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('not_found');

    const recreated = await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    expect(recreated.status).toBe(201);
    expect(await db.collection('crag_members').countDocuments({ cragId: 'roshka' })).toBe(0);
  });

  it('rejects deleting a crag that still has sectors', async () => {
    await write().post('/api/crags').send({ name: 'Roshka', id: 'roshka' });
    await db.collection('sectors').insertOne({
      _id: 'cave-1',
      cragId: 'roshka',
      name: 'Cave',
      geo: null,
      routes: [],
      images: [],
      order: 0,
      version: 1,
      updatedAt: new Date(),
    });
    const res = await write().delete('/api/crags/roshka');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'conflict', message: 'Crag still has sectors' });
    expect(await db.collection('crags').findOne({ _id: 'roshka' })).not.toBeNull();
    expect(await db.collection('sectors').countDocuments({ cragId: 'roshka' })).toBe(1);
  });

  it('lets a superadmin delete an empty external crag', async () => {
    const created = await write().post('/api/crags').send({
      id: 'roshka',
      name: 'Roshka',
      source: 'external',
      externalId: '35366',
    });
    expect(created.status).toBe(201);
    const deleted = await write().delete('/api/crags/roshka');
    expect(deleted.status).toBe(204);
    expect(await db.collection('crags').findOne({ _id: 'roshka' })).toBeNull();
  });

  it('rejects writes without a valid bearer token and still serves the catalog', async () => {
    const catalog = await request(app).get('/api/crags');
    expect(catalog.status).toBe(200);
    expect(catalog.body).toEqual([]);

    const anonymousWrites = [
      () => request(app).post('/api/crags').send({ name: 'Roshka', id: 'roshka' }),
      () => request(app).patch('/api/crags/roshka').send({
        version: 1,
        description: [{ subheader: 'Access', paragraphs: ['Nope'] }],
      }),
      () => request(app).patch('/api/crags/roshka/settings').send({ version: 1, name: 'Nope' }),
      () => request(app).delete('/api/crags/roshka'),
      () => request(app).get('/api/crags/roshka/members'),
      () => request(app).get('/api/crags/roshka/accounts').query({ email: 'a@b.co' }),
      () => request(app).put('/api/crags/roshka/members/user-a').send({ role: 'admin' }),
      () => request(app).delete('/api/crags/roshka/members/user-a'),
      () => request(app).post('/api/crags/roshka/sectors').send({ name: 'Cave' }),
      () => request(app).put('/api/crags/roshka/sectors/cave-1').send({ version: 1, name: 'Cave' }),
      () => request(app).patch('/api/crags/roshka/sectors/cave-1').send({
        version: 1,
        geo: { lat: 1, lon: 2 },
      }),
      () => request(app).delete('/api/crags/roshka/sectors/cave-1'),
      // A second file is a Multer error. 401 means the token check runs before that parser.
      () => request(app)
        .post('/api/crags/roshka/images')
        .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'a.png', contentType: 'image/png' })
        .attach(IMAGE_FIELD_NAME, PNG_1X1, { filename: 'b.png', contentType: 'image/png' }),
    ];
    for (const sendWrite of anonymousWrites) {
      const rejected = await sendWrite();
      expect(rejected.status).toBe(401);
      expect(rejected.body).toEqual({ error: 'unauthorized' });
    }

    const badToken = await request(app)
      .post('/api/crags')
      .set('Authorization', 'Bearer wrong-token')
      .send({ name: 'Roshka', id: 'roshka' });
    expect(badToken.status).toBe(401);
    expect(badToken.body).toEqual({ error: 'unauthorized' });

    const after = await request(app).get('/api/crags');
    expect(after.status).toBe(200);
    expect(after.body).toEqual([]);
    expect(uploaded.size).toBe(0);
  });

  function userApp(uid: string) {
    return appFor({
      uid,
      email: `${uid}@example.com`,
      emailVerified: true,
      superadmin: false,
    });
  }

  async function createDraft(name: string, id: string) {
    return request(app)
      .post('/api/crags')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ name, id });
  }

  it('hides a new crag from anonymous readers and other users', async () => {
    const created = await createDraft('Roshka', 'roshka');
    expect(created.status).toBe(201);
    expect(created.body.published).toBe(false);
    const stored = await db.collection('crags').findOne({ _id: 'roshka' });
    expect(stored?.published).toBe(false);

    expect((await request(app).get('/api/crags')).body).toEqual([]);
    expect((await request(app).get('/api/crags/roshka')).status).toBe(404);
    expect((await request(app).get('/api/crags/roshka/gpx')).status).toBe(404);

    const badToken = await request(app).get('/api/crags').set('Authorization', 'Bearer wrong-token');
    expect(badToken.status).toBe(401);

    const superCatalog = await write().get('/api/crags');
    expect(superCatalog.body).toEqual([
      expect.objectContaining({ id: 'roshka', published: false }),
    ]);
    expect((await write().get('/api/crags/roshka')).status).toBe(200);

    await db.collection('crags').insertOne({
      _id: 'public-crag',
      name: 'Public',
      source: 'explorer',
      protocolVersion: CRAG_DATA_PROTOCOL,
      description: [],
      trails: [],
      markers: [],
      version: 1,
      updatedAt: new Date(),
    });
    await db.collection('crag_members').insertMany([
      { cragId: 'roshka', userId: 'owner-user', role: 'owner' },
      { cragId: 'roshka', userId: 'admin-user', role: 'admin' },
      { cragId: 'public-crag', userId: 'other-owner', role: 'owner' },
    ]);

    const ids = async (uid: string) => {
      const catalog = await request(userApp(uid))
        .get('/api/crags')
        .set('Authorization', `Bearer ${uid}-token`);
      expect(catalog.status).toBe(200);
      return catalog.body.map((crag: { id: string }) => crag.id).sort();
    };
    expect(await ids('owner-user')).toEqual(['public-crag', 'roshka']);
    expect(await ids('admin-user')).toEqual(['public-crag', 'roshka']);
    expect(await ids('stranger')).toEqual(['public-crag']);
    expect(await ids('other-owner')).toEqual(['public-crag']);

    const ownerOpen = await request(userApp('owner-user'))
      .get('/api/crags/roshka')
      .set('Authorization', 'Bearer owner-token');
    expect(ownerOpen.status).toBe(200);
    const adminGpx = await request(userApp('admin-user'))
      .get('/api/crags/roshka/gpx')
      .set('Authorization', 'Bearer admin-token');
    expect(adminGpx.status).toBe(200);
    const strangerOpen = await request(userApp('stranger'))
      .get('/api/crags/roshka')
      .set('Authorization', 'Bearer stranger-token');
    expect(strangerOpen.status).toBe(404);

    const strangerApp = userApp('stranger');
    const strangerAuth = { Authorization: 'Bearer stranger-token' };
    const notFoundBody = { error: 'not_found', message: 'crag not found' };
    const contentPatch = {
      version: 1,
      description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
    };
    async function expectHiddenLikeMissing(
      run: (id: string) => PromiseLike<{ status: number; body: unknown }>,
    ) {
      const hidden = await run('roshka');
      const missing = await run('no-such-crag');
      expect(hidden.status).toBe(404);
      expect(hidden.body).toEqual(notFoundBody);
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual(hidden.body);
    }
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).patch(`/api/crags/${id}`).set(strangerAuth).send(contentPatch)
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).get(`/api/crags/${id}/members`).set(strangerAuth)
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).get(`/api/crags/${id}/accounts`).query({ email: 'a@b.co' }).set(strangerAuth)
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).put(`/api/crags/${id}/members/user-a`).set(strangerAuth).send({ role: 'admin' })
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).delete(`/api/crags/${id}/members/user-a`).set(strangerAuth)
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).post(`/api/crags/${id}/sectors`).set(strangerAuth).send({ name: 'Cave' })
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).put(`/api/crags/${id}/sectors/cave-1`).set(strangerAuth).send({
        version: 1,
        name: 'Cave',
      })
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).patch(`/api/crags/${id}/sectors/cave-1`).set(strangerAuth).send({
        version: 1,
        geo: { lat: 1, lon: 2 },
      })
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).delete(`/api/crags/${id}/sectors/cave-1`).set(strangerAuth)
    ));
    await expectHiddenLikeMissing((id) => (
      request(strangerApp).post(`/api/crags/${id}/images`).set(strangerAuth)
    ));
    async function expectForbiddenEitherWay(
      run: (id: string) => PromiseLike<{ status: number; body: unknown }>,
    ) {
      const hidden = await run('roshka');
      const missing = await run('no-such-crag');
      expect(hidden.status).toBe(403);
      expect(hidden.body).toEqual({ error: 'forbidden' });
      expect(missing.status).toBe(403);
      expect(missing.body).toEqual(hidden.body);
    }
    await expectForbiddenEitherWay((id) => (
      request(strangerApp).patch(`/api/crags/${id}/settings`).set(strangerAuth).send({
        version: 1,
        published: true,
      })
    ));
    await expectForbiddenEitherWay((id) => (
      request(strangerApp).delete(`/api/crags/${id}`).set(strangerAuth)
    ));
    expect(await db.collection('crags').findOne({ _id: 'roshka' })).not.toBeNull();
    const otherOwner = await request(userApp('other-owner'))
      .patch('/api/crags/roshka')
      .set('Authorization', 'Bearer other-owner-token')
      .send(contentPatch);
    expect(otherOwner.status).toBe(404);
    expect(otherOwner.body).toEqual(notFoundBody);

    const ownerEdit = await request(userApp('owner-user'))
      .patch('/api/crags/roshka')
      .set('Authorization', 'Bearer owner-token')
      .send(contentPatch);
    expect(ownerEdit.status).toBe(200);
    const adminMembers = await request(userApp('admin-user'))
      .get('/api/crags/roshka/members')
      .set('Authorization', 'Bearer admin-token');
    expect(adminMembers.status).toBe(200);
    const adminLookup = await request(userApp('admin-user'))
      .get('/api/crags/roshka/accounts')
      .query({ email: 'a@b.co' })
      .set('Authorization', 'Bearer admin-token');
    expect(adminLookup.status).toBe(403);
    expect(adminLookup.body).toEqual({ error: 'forbidden' });

    const ownerPatch = await request(userApp('owner-user'))
      .patch('/api/crags/roshka/settings')
      .set('Authorization', 'Bearer owner-token')
      .send({ version: 1, published: true });
    expect(ownerPatch.status).toBe(403);
    expect(ownerPatch.body).toEqual({ error: 'forbidden' });
  });

  it('lets a superadmin publish and unpublish an external crag', async () => {
    await db.collection('crags').insertOne({
      _id: 'roshka',
      name: 'Roshka',
      source: 'external',
      protocolVersion: CRAG_DATA_PROTOCOL,
      description: [],
      trails: [],
      markers: [],
      externalId: '35366',
      published: true,
      version: 1,
      updatedAt: new Date(),
    });

    const unpublished = await write().patch('/api/crags/roshka/settings').send({
      version: 1,
      published: false,
    });
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.published).toBe(false);
    expect(unpublished.body.version).toBe(2);
    expect((await request(app).get('/api/crags/roshka')).status).toBe(404);
    expect((await request(app).get('/api/crags/roshka/gpx')).status).toBe(404);

    const stranger = userApp('stranger');
    const strangerAuth = { Authorization: 'Bearer stranger-token' };
    const hiddenContent = await request(stranger)
      .patch('/api/crags/roshka')
      .set(strangerAuth)
      .send({
        version: 2,
        description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
      });
    expect(hiddenContent.status).toBe(404);
    expect(hiddenContent.body).toEqual({ error: 'not_found', message: 'crag not found' });
    const hiddenMembers = await request(stranger)
      .get('/api/crags/roshka/members')
      .set(strangerAuth);
    expect(hiddenMembers.status).toBe(404);
    expect(hiddenMembers.body).toEqual({ error: 'not_found', message: 'crag not found' });

    await db.collection('crag_members').insertOne({
      cragId: 'roshka',
      userId: 'owner-user',
      role: 'owner',
    });
    const ownerContent = await request(userApp('owner-user'))
      .patch('/api/crags/roshka')
      .set('Authorization', 'Bearer owner-token')
      .send({
        version: 2,
        description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
      });
    expect(ownerContent.status).toBe(403);
    expect(ownerContent.body.error).toBe('read_only');

    const superContent = await write().patch('/api/crags/roshka').send({
      version: 2,
      description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
    });
    expect(superContent.status).toBe(403);
    expect(superContent.body.error).toBe('read_only');

    const renamed = await write().patch('/api/crags/roshka/settings').send({
      version: 2,
      name: 'Renamed',
    });
    expect(renamed.status).toBe(403);
    expect(renamed.body.error).toBe('read_only');

    const published = await write().patch('/api/crags/roshka/settings').send({
      version: 2,
      published: true,
    });
    expect(published.status).toBe(200);
    expect(published.body.published).toBe(true);
    const catalog = await request(app).get('/api/crags');
    expect(catalog.body).toEqual([
      expect.objectContaining({ id: 'roshka', published: true, source: 'external' }),
    ]);
  });

  it('keeps a crag public when published is missing', async () => {
    await db.collection('crags').insertOne({
      _id: 'legacy',
      name: 'Legacy',
      source: 'external',
      protocolVersion: CRAG_DATA_PROTOCOL,
      description: [],
      trails: [],
      markers: [],
      version: 1,
      updatedAt: new Date(),
    });
    const catalog = await request(app).get('/api/crags');
    expect(catalog.body).toEqual([
      expect.objectContaining({ id: 'legacy', published: true }),
    ]);
    expect((await request(app).get('/api/crags/legacy')).status).toBe(200);
  });
});
