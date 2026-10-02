import { initializeFirebase } from '@crag-to-all/shared-firebase';
import { MongoClient } from 'mongodb';
import { createApp } from './app';
import { getConfig } from './config';
import { createFirebaseImageStorage } from './storage';
import { ensureIndexes } from './store';

async function main(): Promise<void> {
  const config = getConfig();
  const client = new MongoClient(config.mongodbUri);

  try {
    await client.connect();
  } catch (error) {
    console.error(
      `Cannot connect to MongoDB at ${config.mongodbUri}. Start the local MongoDB service and retry.`,
      error,
    );
    process.exitCode = 1;
    return;
  }

  process.env.FIREBASE_PROJECT_ID = config.firebaseProjectId;
  process.env.FIREBASE_STORAGE_BUCKET = config.firebaseStorageBucket;
  if (config.firebaseUseEmulator) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = config.firebaseStorageEmulatorHost;
  }
  initializeFirebase(config.firebaseUseEmulator);

  const db = client.db(config.mongodbDb);
  await ensureIndexes(db);

  const app = createApp(db, { storage: createFirebaseImageStorage() });
  const server = app.listen(config.port, () => {
    console.log(`crag-api listening on http://localhost:${config.port}`);
    if (config.firebaseUseEmulator) {
      console.log(
        `Image uploads use Storage emulator at ${config.firebaseStorageEmulatorHost}`,
      );
    }
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down`);
    server.close();
    try {
      await client.close();
    } catch (error) {
      console.error('Error closing MongoDB client:', error);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void main();
