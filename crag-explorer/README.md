# crag-explorer

React + Vite PWA for browsing climbing sectors, topos, routes, maps, and downloadable guides.

Crag documents are loaded from crag-api. Images, GPX, PDFs, and offline map-tile packs come from Firebase Storage.

## Development

From the repo root:

```bash
npm run dev
```

Or inside this folder after `shared-crag` is built:

```bash
npm ci
npm run dev          # local API via the /api proxy, production Storage files
npm run dev-local    # local API, Storage emulator at localhost:9199, Auth emulator at 127.0.0.1:9099
npm run build
npm run seo-check
```

Start `crag-api` on port 3010 before `npm run dev`. Production builds set `VITE_API_BASE_URL` once the API is public. Reads stay anonymous.

## Sign in on dev-local

Local editing is three processes. From the repo root, start the emulators, then the API:

```bash
npm run emulator:start
npm run dev:api
```

Then in this folder:

```bash
npm run dev-local
```

`dev-local` sets `VITE_DEV_LOCAL=true`. The app connects Firebase Auth to `http://127.0.0.1:9099` with a demo web config for project `crag-to-all`. Production Authentication stays off. `npm run dev` and production builds do not initialize Firebase Auth, and the header does not offer sign-in, so a password is not sent to Identity Toolkit. This slice has no production web config.

The header **Sign in** button opens a dialog for email sign-in, creating an account, Google, and password reset. **Sign out** sits in that header once an email is shown. The emulator does not send mail. Read the reset message in the emulator UI at http://localhost:4000. Google sign-in there is a fake account form. Accounts stay in gitignored `emulator-data` on this machine.

`getAccessToken()` returns the signed-in user's ID token, or `null` when nobody is signed in. `apiFetch` sends `Authorization: Bearer` when a token is present. The API rejects a write without a valid token (**401**). A signed-out visitor can still load the catalog and a crag.

The explorer shows edit controls for a superadmin, or for an owner or admin of that crag. Sign-in loads that user's rows from `GET /api/me/memberships`. A signed-in user with no row sees no editors. The API allows an explorer-crag change when the ID token custom claim `superadmin` is the boolean `true`, or when that user is an owner or admin in `crag_members`. Extracted crags stay read-only. In the Auth emulator, set the claim under Authentication, edit user, Custom claims, as `{ "superadmin": true }` (a JSON boolean, not the string `"true"`). In production, run `npm run set-superadmin -- <uid>` in `crag-api`. After a change, reload the explorer. Sign-in refreshes the ID token, so the new claim is used without signing out. Phone auth stays off. Do not upgrade the project to Firebase Authentication with Identity Platform.

## SEO

Hybrid SEO: build-time tags patched into `index.html`, plus runtime updates in `SeoDynamic.tsx`. The patch loads each crag from `VITE_API_BASE_URL` (default `http://localhost:3010`). See `scripts/README.md`.
