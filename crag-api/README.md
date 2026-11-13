# crag-api

Local Express API (port **3010**) for crag and sector documents in MongoDB. The database starts empty; create crags and sectors with `POST`.

Catalog and crag reads are anonymous. These routes require `Authorization: Bearer <Firebase ID token>`: `POST /api/crags`, `PATCH /api/crags/:cragId`, image upload, sector `POST` / `PUT` / `PATCH` / `DELETE`, `GET /api/me/memberships`, and `GET` / `PUT` / `DELETE` `/api/crags/:cragId/members`. A missing or invalid token returns **401** `{ error: 'unauthorized' }`. Creating a crag requires a superadmin and does not insert a `crag_members` row. An explorer crag, including its image upload, can be changed by a superadmin, or by a `crag_members` owner or admin. Any other signed-in user gets **403** `{ error: 'forbidden' }`. Membership list, upsert, and delete are narrower: a superadmin may set or remove `owner` or `admin`; an owner may set or remove `admin` only, and cannot change or remove an owner, including themselves. An admin, or a signed-in user with no row, gets **403**. A missing membership on delete is **404**. Several owners are allowed, and removing the last owner is allowed. There is no explorer screen for granting roles. Extracted crags (`source: external`) stay read-only (**403** `read_only`) for content changes and for membership list, upsert, and delete, including for a superadmin. The explorer shows edit controls for a superadmin, or for an owner or admin of that crag. At sign-in it loads that user's rows from `GET /api/me/memberships`. Production Authentication stays off.

Explorer proxies `/api` to `http://localhost:3010`.

## Local sign-in

Identity for this slice is the Auth emulator on project `crag-to-all`, port **9099**. Start it with the Storage emulator from the repo root (`npm run emulator:start`, Java 21+). The UI is http://localhost:4000. The emulator does not send real mail. Password-reset messages show up there. Google sign-in in that UI is a fake account form.

`FIREBASE_USE_EMULATOR` defaults to `true`. The API then sets `FIREBASE_AUTH_EMULATOR_HOST` to `127.0.0.1:9099` before `initializeFirebase`, so `verifyIdToken` accepts emulator tokens without a service account.

Sign in from `crag-explorer` with `npm run dev-local`. That client attaches the ID token on writes. See [`crag-explorer/README.md`](../crag-explorer/README.md).

Phone auth stays disabled. Do not upgrade the project to Firebase Authentication with Identity Platform.

## Superadmin

Superadmin is the custom claim `superadmin` on the Firebase Auth user. The API sets that flag only when the verified ID token has the claim as the boolean `true`. The string `"true"`, the number `1`, and a missing claim are not a superadmin. There is no email allowlist. The API never writes the claim, and per-crag owner and admin stay in MongoDB `crag_members`.

In the Auth emulator UI (http://localhost:4000): Authentication, edit the user, Custom claims, save `{ "superadmin": true }` with a JSON boolean.

The production Firebase console user page has no claims field. From this folder, with `FIREBASE_SERVICE_ACCOUNT_KEY` or `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` set (see [`packages/shared-firebase/.env.example`](../packages/shared-firebase/.env.example)), and after `shared-firebase` is built:

```bash
npm run set-superadmin -- <uid>
```

That calls `setCustomUserClaims` with `superadmin` set to boolean `true` and keeps any other custom claims. It uses the service account and ignores `FIREBASE_AUTH_EMULATOR_HOST`, so it does not update the Auth emulator.

The claim is copied into the ID token. The explorer refreshes that token when sign-in starts, including a page reload. The API trusts the verified token and does not call `getUser` on each request.

## Run locally

Install MongoDB locally so it listens on `127.0.0.1:27017` (the Windows installer can run it as a service).

Image upload talks to the Firebase Storage emulator (port **9199**). ID tokens are checked by the Auth emulator (port **9099**). Start both from the repo root (Java 21+ required):

```bash
npm run emulator:start
```

Then:

```bash
npm run build-shared-crag
npm run build-shared-firebase
cd crag-api
npm ci
npm run dev
```

Or from the repo root: `npm run dev:api`.

Optional `.env` (see `.env.example`): `PORT`, `MONGODB_URI`, `MONGODB_DB`, `FIREBASE_USE_EMULATOR` (default `true`), `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_STORAGE_EMULATOR_HOST` (default `127.0.0.1:9199`), `FIREBASE_AUTH_EMULATOR_HOST` (default `127.0.0.1:9099`).

## HTTP

| Method | Path | Auth | Role |
| --- | --- | --- | --- |
| GET | `/api/crags` | anonymous | Catalog (`{ id, cragId, cragName, source }[]`) |
| POST | `/api/crags` | bearer | Superadmin only. Create empty `explorer` crag (`{ name, cragId? }`). No owner row. |
| GET | `/api/crags/:cragId` | anonymous | Assembled `CragData` plus `version` |
| PATCH | `/api/crags/:cragId` | bearer | Crag-level fields; body must include `version`; stale version → **409** |
| GET | `/api/me/memberships` | bearer | Caller's rows, loaded at sign-in: `{ memberships: [{ cragId, role }] }` |
| GET | `/api/crags/:cragId/members` | bearer | Owner or superadmin. `{ userId, role }[]`. Extracted crag → **403** `read_only` |
| PUT | `/api/crags/:cragId/members/:userId` | bearer | Upsert `{ role: "owner" \| "admin" }`. Returns `{ userId, role }`. Extracted crag → **403** `read_only` |
| DELETE | `/api/crags/:cragId/members/:userId` | bearer | Remove that row. Missing row → **404**. Extracted crag → **403** `read_only` |
| POST | `/api/crags/:cragId/sectors` | bearer | Add a sector (UUID id, `version: 1`) |
| PUT | `/api/crags/:cragId/sectors/:sectorId` | bearer | Replace that sector; body includes `version`; stale → **409** |
| PATCH | `/api/crags/:cragId/sectors/:sectorId` | bearer | Update sector coordinates (`{ version, geo }`); stale version → **409** |
| DELETE | `/api/crags/:cragId/sectors/:sectorId` | bearer | Remove that sector |
| POST | `/api/crags/:cragId/images` | bearer | Multipart field `image`; Admin SDK upload to `{cragId}/images/{sha256}.{ext}` |
| GET | `/api/crags/:cragId/gpx` | anonymous | GPX built from current Mongo state (`application/gpx+xml`; no Storage write) |

`POST .../images` checks the bearer token before reading the multipart body. A request without a valid token is **401**, and the file is not stored. A successful upload returns `{ imageFile, storagePath }`. The explorer still loads images from Storage URLs using `imageFile`.

## Tests

```bash
npm test
```

Uses an in-memory MongoDB, a fake Storage adapter, and a fake ID-token verifier that accepts `Bearer test-token`. That caller has `superadmin: true`. A local MongoDB install and the Firebase emulator are not required. The first run downloads a MongoDB binary (cached afterwards). Write calls without a token, and calls with a bad token, expect **401**. A catalog `GET` without a token stays **200**.
