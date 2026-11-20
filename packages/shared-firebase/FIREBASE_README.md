# Firebase Storage and Auth emulators

Shared Firebase Admin SDK, Storage emulator, and Auth emulator used by `crag-api` and the private pipeline (`crag-extract`, `crag-to-pdf`).

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install Firebase and Firebase Admin SDK dependencies.

### 2. Firebase Emulator (Local Development)

For local development, one emulator process serves Storage and Authentication. That avoids costs and works offline. The hosted explorer uses production Authentication for project `crag-to-all`.

The emulators require **Java 21+** on PATH (`java -version`). Eclipse Temurin 21 works. Storage is the piece that needs Java.

#### Start Emulator Only
```bash
npm run emulator:start
```

| Service | Port |
| --- | --- |
| Emulator UI | http://localhost:4000 |
| Authentication | 127.0.0.1:9099 |
| Storage | 9199 |

Storage files and Auth accounts are copied into `emulator-data` a few seconds after they change. Ctrl-C does not have to finish for that copy to stick. The next start imports `emulator-data` again. `emulator-data` is gitignored, so accounts created here stay on this machine.

The Auth emulator does not send real email. Password-reset messages show up in the emulator UI. Google and Facebook sign-in in that UI are fake account forms, not real accounts. Phone authentication stays off.

### 3. Running the Scraper with Emulator

#### Manual (Two terminals)
Terminal 1:
```bash
npm run emulator:start
```

Terminal 2 (after emulator starts):
```bash
npm run start
```

## Data Structure

The data is stored in Firebase Storage with the same structure as the local `public/data` folder:

```
index.json
crags/
├── roshka/
│   ├── roshka.json
│   └── topo-images/
│       ├── abc123.jpg
│       └── def456.jpg
└── other-crag/
    ├── other-crag.json
    └── topo-images/
        └── ghi789.jpg
```

## Environment Variables

Use `.env.example` in this package as the source of truth:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET_v2` (defaults to `crag-to-all` when unset)
- `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string for service account)

Behavior:

- In local mode (`--dev-local`), service account is not required.
- In production mode, project id and service account are required and startup fails fast if either is missing. The bucket name falls back to `crag-to-all`.

## Authentication

Local sign-in uses the Auth emulator on `127.0.0.1:9099` for project `crag-to-all`. The methods are email/password and the emulator's fake Google and Facebook providers. Phone authentication stays off. Do not upgrade the project to Firebase Authentication with Identity Platform.

`crag-explorer` signs in on `npm run dev-local` (`VITE_DEV_LOCAL=true`), which connects the client to `http://127.0.0.1:9099`. `npm run dev` leaves the production web config unset, so it does not initialize Firebase Auth and does not show sign-in. A production build uses `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`, and the hosted site shows **Sign in**. Turn on Email/Password, Google, and Facebook in the Firebase console, and add `crags-for-all.web.app` and `crags-for-all.firebaseapp.com` as authorized domains. Facebook also needs the Meta app's App ID and App Secret on that provider. On `dev-local`, the header **Sign in** dialog creates an account, signs in with Google or Facebook, or requests a password reset. Reset messages appear in the emulator UI. On the hosted site, password reset sends a real email. See [`crag-explorer/README.md`](../../crag-explorer/README.md).

`crag-api` writes require that user's ID token (`Authorization: Bearer`). Reads stay anonymous. With `FIREBASE_USE_EMULATOR` (the API default), `initializeFirebase` points Admin Auth at `FIREBASE_AUTH_EMULATOR_HOST` (default `127.0.0.1:9099`). `verifyFirebaseIdToken` then accepts emulator tokens without a service account. See [`crag-api/README.md`](../../crag-api/README.md).

Per-crag owner and admin live in MongoDB `crag_members`, outside this package. Superadmin is the custom claim `{ "superadmin": true }` on the Auth user, and only the JSON boolean counts. The string `"true"` does not. In the Auth emulator, set it under Authentication, edit user, Custom claims. The production console user page has no claims field. `crag-api` sets it with `npm run set-superadmin -- <uid>`, which calls `setCustomUserClaims` through this package and keeps other claims. The claim is copied into the ID token, so it takes effect after the next sign-in or `getIdToken(true)`. `crag-api` reads the verified token and does not call `getUser` on each request. The explorer still shows edit controls for every signed-in user.

## Production Setup

To use real Firebase Storage in production:

1. Create a Firebase project
2. Create a service account with Storage access (Google Cloud IAM)
3. Put the full JSON key into `FIREBASE_SERVICE_ACCOUNT_KEY` (single-line JSON secret)
4. Set `FIREBASE_PROJECT_ID`. Set `FIREBASE_STORAGE_BUCKET_v2` only to override the default bucket `crag-to-all`
5. Ensure proper Firebase Storage rules

## Production Rules Strategy

Current `storage.rules` strategy:

- Public read is enabled for explorer/public links (JSON, GPX, PDF, images, tiles)
- `crags/{cragId}/history/**` backups are not publicly readable
- Client writes are denied
- Writes (and history reads) from `crag-extract` and `crag-to-pdf` work via Firebase Admin SDK (rules are bypassed for server credentials)

## Benefits

- **Scalability**: Firebase Storage can handle large amounts of data
- **Accessibility**: Data can be accessed from anywhere
- **Backup**: Automatic backup and redundancy
- **Local Development**: Emulator allows offline development
- **Cost Control**: Emulator prevents accidental charges during development

## Troubleshooting

### Emulator Not Starting
- Install Java 21+ and confirm `java -version` works in a new terminal
- Run `npm install` in this package so `firebase-tools` is local
- Check if ports 9099 (auth), 9199 (storage), and 4000 (UI) are available

### Connection Issues
- Verify emulator is running: http://localhost:4000
- Check console for connection errors
- Ensure environment variables are set correctly

### Data Not Uploading
- Check Firebase console in emulator UI
- Verify `FIREBASE_SERVICE_ACCOUNT_KEY` is configured correctly
- Check network connectivity (for production)

### Files or accounts missing after an emulator restart
`emulator-data` is only as new as the last successful snapshot. On Windows, stopping the emulator with Ctrl-C used to kill the process before `--export-on-exit` wrote anything, so files uploaded in that session were gone on the next start. Snapshots are now taken while the emulator is running, and each snapshot includes Auth accounts alongside Storage. If the Auth emulator cannot be read, the Storage snapshot is still kept. Restart `npm run emulator:start` once so that saver is the process that is running.
