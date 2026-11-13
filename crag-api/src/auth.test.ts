import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireAuth } from './app';
import { toAuthCaller } from './auth';
import { errorHandler } from './http';
import type { AuthCaller } from './types';

function callerApp(verifyIdToken: (idToken: string) => Promise<AuthCaller>) {
  const app = express();
  app.get('/caller', requireAuth({ verifyIdToken }), (req, res) => {
    res.json({ caller: req.caller });
  });
  app.use(errorHandler);
  return app;
}

describe('toAuthCaller', () => {
  it('maps uid, email, and email_verified from the token', () => {
    expect(
      toAuthCaller({ uid: 'abc', email: ' A@Example.com ', email_verified: false }),
    ).toEqual({
      uid: 'abc',
      email: 'A@Example.com',
      emailVerified: false,
      superadmin: false,
    });
  });

  it('uses null and false when the token omits email claims', () => {
    expect(toAuthCaller({ uid: 'abc' })).toEqual({
      uid: 'abc',
      email: null,
      emailVerified: false,
      superadmin: false,
    });
    expect(toAuthCaller({ uid: 'abc', email: '   ', email_verified: true })).toEqual({
      uid: 'abc',
      email: null,
      emailVerified: true,
      superadmin: false,
    });
  });

  it('sets superadmin only when the custom claim is the boolean true', () => {
    expect(toAuthCaller({ uid: 'abc', superadmin: true }).superadmin).toBe(true);
    expect(toAuthCaller({ uid: 'abc', superadmin: 'true' }).superadmin).toBe(false);
    expect(toAuthCaller({ uid: 'abc', superadmin: 1 }).superadmin).toBe(false);
    expect(toAuthCaller({ uid: 'abc', superadmin: false }).superadmin).toBe(false);
    expect(toAuthCaller({ uid: 'abc' }).superadmin).toBe(false);
  });
});

describe('requireAuth', () => {
  it('stores the caller when superadmin is false', async () => {
    const caller = {
      uid: 'u1',
      email: 'admin@example.com',
      emailVerified: false,
      superadmin: false,
    };
    const app = callerApp(async () => caller);
    const res = await request(app).get('/caller').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ caller });
  });

  it('stores the caller when superadmin is true and leaves emailVerified unchanged', async () => {
    const caller = {
      uid: 'u1',
      email: 'Admin@Example.com',
      emailVerified: false,
      superadmin: true,
    };
    const app = callerApp(async () => caller);
    const res = await request(app).get('/caller').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ caller });
  });

  it('answers a missing or invalid token with 401', async () => {
    const app = callerApp(async () => {
      throw new Error('invalid token');
    });
    const missing = await request(app).get('/caller');
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: 'unauthorized' });

    const invalid = await request(app).get('/caller').set('Authorization', 'Bearer nope');
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ error: 'unauthorized' });
  });
});
