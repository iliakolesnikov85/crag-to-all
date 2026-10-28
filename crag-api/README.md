# crag-api

Local Express API (port **3010**) for crag and sector documents in MongoDB. The database starts empty; create crags and sectors with `POST`. There is no auth — do not deploy this until auth exists.

Explorer already proxies `/api` to `http://localhost:3010`.

## Run locally

Install MongoDB locally so it listens on `127.0.0.1:27017` (the Windows installer can run it as a service).

Image upload talks to the Firebase Storage emulator (port **9199**). Start it from the repo root (Java 21+ required):

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

Optional `.env` (see `.env.example`): `PORT`, `MONGODB_URI`, `MONGODB_DB`, `FIREBASE_USE_EMULATOR` (default `true`), `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_STORAGE_EMULATOR_HOST`.

## HTTP

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/crags` | Catalog (`{ id, cragId, cragName, source, externalId? }[]`) |
| POST | `/api/crags` | Create empty `explorer` crag (`{ name, cragId? }`) |
| GET | `/api/crags/:cragId` | Assembled `CragData` plus `version` |
| PATCH | `/api/crags/:cragId` | Crag-level fields; body must include `version`; stale version → **409** |
| POST | `/api/crags/:cragId/sectors` | Add a sector (UUID id, `version: 1`) |
| PUT | `/api/crags/:cragId/sectors/:sectorId` | Replace that sector; body includes `version`; stale → **409** |
| PATCH | `/api/crags/:cragId/sectors/:sectorId` | Update sector coordinates (`{ version, geo }`); stale version → **409** |
| DELETE | `/api/crags/:cragId/sectors/:sectorId` | Remove that sector |
| POST | `/api/crags/:cragId/images` | Multipart field `image`; Admin SDK upload to `{cragId}/images/{sha256}.{ext}` |
| GET | `/api/crags/:cragId/gpx` | GPX built from current Mongo state (`application/gpx+xml`; no Storage write) |

`POST .../images` returns `{ imageFile, storagePath }`. The explorer still loads images from Storage URLs using `imageFile`.

## Tests

```bash
npm test
```

Uses an in-memory MongoDB and a fake Storage adapter; a local MongoDB install and the Firebase emulator are not required. The first run downloads a MongoDB binary (cached afterwards).
