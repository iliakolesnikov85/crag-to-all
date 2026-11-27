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
```

Start `crag-api` on port 3010 before `npm run dev`. Production builds set `VITE_API_BASE_URL` once the API is public. Storage URLs use `VITE_FIREBASE_STORAGE_BUCKET_v2` (default `crag-to-all`). Reads stay anonymous.

## Sign in

Local editing with the Auth emulator is three processes. From the repo root, start the emulators, then the API:

```bash
npm run emulator:start
npm run dev:api
```

Then in this folder:

```bash
npm run dev-local
```

`dev-local` sets `VITE_DEV_LOCAL=true`. The app connects Firebase Auth to `http://127.0.0.1:9099` with a demo web config for project `crag-to-all`. Accounts stay in gitignored `emulator-data` on this machine. The emulator does not send mail. Read the reset and verification messages in the emulator UI at http://localhost:4000. Google and Facebook sign-in there are fake account forms.

`npm run dev` leaves the production web config unset, so the header does not offer sign-in. The local API still checks emulator tokens.

A production build signs in against Firebase Authentication for project `crag-to-all`. The build needs `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. See `.env.example`. `authDomain` is `crag-to-all.firebaseapp.com`. Deploy passes those values from the `pre-prod` GitHub environment. The hosted site then shows **Sign in** in the header.

The header **Sign in** button opens a dialog for email sign-in, creating an account, Google, Facebook, and password reset. Creating an email account asks Firebase to send a verification link. **Sign out** sits in that header once an email is shown. The header menu **Profile** dialog can change the name, send the verification link again, and send a password reset. A crag owner can add the account only after the email is verified.

In the Firebase console for project `crag-to-all`, turn on Email/Password, Google, and Facebook. Add authorized domains `crags-for-all.web.app` and `crags-for-all.firebaseapp.com`. Set a support email on the Google OAuth consent screen. For Facebook, create a Meta app, turn on Facebook Login, and paste its App ID and App Secret into the Firebase provider. Add `https://crag-to-all.firebaseapp.com/__/auth/handler` as a valid OAuth redirect URI in that Meta app. Password reset and email verification on the hosted site send a real email.

`getAccessToken()` returns the signed-in user's ID token, or `null` when nobody is signed in. `apiFetch` sends `Authorization: Bearer` when a token is present. The API rejects a write without a valid token (**401**). A signed-out visitor can still load the catalog and a crag.

The explorer shows edit controls for a superadmin, or for an owner or admin of that crag. Sign-in loads that user's rows from `GET /api/me/memberships`. A signed-in user with no row sees no editors. The API allows an explorer-crag change when the ID token custom claim `superadmin` is the boolean `true`, or when that user is an owner or admin in `crag_members`. Extracted crags stay read-only. In the Auth emulator, set the claim under Authentication, edit user, Custom claims, as `{ "superadmin": true }` (a JSON boolean, not the string `"true"`). In production, run `npm run set-superadmin -- <uid> <service-account.json>` in `crag-api`. After a change, reload the explorer. Sign-in refreshes the ID token, so the new claim is used without signing out. Phone auth stays off. Do not upgrade the project to Firebase Authentication with Identity Platform.

## SEO

Homepage SEO is built from published crags by `buildHomepageSeo` in `@crag-to-all/shared-crag`. The GitHub Actions script `scripts/patch-homepage-seo` writes the title, description, share-preview, and JSON-LD tags into the live `index.html` after each deploy and after the nightly route-stats job. The site name in those tags is always "Crag Explorer".

The app sets the title, description, and canonical link for each page it shows: `Homepage`, `AboutPage`, and `CragManagePage` use `usePageHead`, and `SeoDynamic` does it for every page of a crag. A sector or route page names that sector or route. Every other crag page describes the crag. The canonical link uses `VITE_SITE_URL`, so a visit through a preview host still names the real site. The page text comes from `buildCragSeo`, `buildSectorSeo`, and `buildRouteSeo` in `@crag-to-all/shared-crag`.

Known limitation: every app path is served the same `index.html`, so a crawler that does not run JavaScript sees the homepage title, share-preview tags, and JSON-LD on crag pages too. The patched file has no canonical or URL tag for that reason. The site stays `noindex` until this changes. See `scripts/README.md`.
