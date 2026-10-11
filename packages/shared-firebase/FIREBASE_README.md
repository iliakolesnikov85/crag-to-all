# Firebase Storage Integration

Shared Firebase Admin SDK and Storage emulator used by `crag-api` and the private pipeline (`crag-extract`, `crag-to-pdf`).

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install Firebase and Firebase Admin SDK dependencies.

### 2. Firebase Emulator (Local Development)

For local development, we use Firebase Storage Emulator to avoid costs and work offline.

The Storage emulator requires **Java 21+** on PATH (`java -version`). Eclipse Temurin 21 works.

#### Start Emulator Only
```bash
npm run emulator:start
```

The UI will be available at: http://localhost:4000

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
crag-data/
├── index.json
├── roshka/
│   ├── roshka.json
│   └── images/
│       ├── abc123.jpg
│       └── def456.jpg
└── other-crag/
    ├── other-crag.json
    └── images/
        └── ghi789.jpg
```

## Environment Variables

Use `.env.example` in this package as the source of truth:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string for service account)

Behavior:

- In local mode (`--dev-local`), service account is not required.
- In production mode, all vars above are required and startup fails fast if any are missing.

## Production Setup

To use real Firebase Storage in production:

1. Create a Firebase project
2. Create a service account with Storage access (Google Cloud IAM)
3. Put the full JSON key into `FIREBASE_SERVICE_ACCOUNT_KEY` (single-line JSON secret)
4. Set `FIREBASE_PROJECT_ID` and `FIREBASE_STORAGE_BUCKET`
5. Ensure proper Firebase Storage rules

## Production Rules Strategy

Current `storage.rules` strategy:

- Public read is enabled for explorer/public links (JSON, GPX, PDF, images, tiles)
- `{cragId}/history/**` backups are not publicly readable
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
- Check if ports 9199 (storage) and 4000 (UI) are available

### Connection Issues
- Verify emulator is running: http://localhost:4000
- Check console for connection errors
- Ensure environment variables are set correctly

### Data Not Uploading
- Check Firebase console in emulator UI
- Verify `FIREBASE_SERVICE_ACCOUNT_KEY` is configured correctly
- Check network connectivity (for production)
