import { applyFirebaseEnv, connectMongo, initializeFirebase } from '@crag-to-all/shared-firebase';
import { createApp } from './app';
import { createFirebaseAuthDirectory, createFirebaseIdTokenVerifier } from './auth';
import { getConfig } from './config';
import { createFirebaseImageStorage } from './storage';
import { ensureIndexes } from './store';

async function main(): Promise<void> {
  const config = getConfig();
  applyFirebaseEnv(config.firebase);
  initializeFirebase(config.firebase.useEmulator);

  let client;
  try {
    client = await connectMongo(config.mongo);
  } catch (error) {
    console.error('crag-api is stopping because MongoDB did not connect:', error);
    process.exitCode = 1;
    return;
  }

  const db = client.db(config.mongo.db);
  await ensureIndexes(db);

  const app = createApp(db, {
    storage: createFirebaseImageStorage(),
    auth: createFirebaseIdTokenVerifier(),
    accounts: createFirebaseAuthDirectory(),
  });
  const server = app.listen(config.port, () => {
    console.log(`crag-api listening on http://localhost:${config.port}`);
    if (config.firebase.useEmulator) {
      console.log(
        `Image uploads use Storage emulator at ${config.firebase.storageEmulatorHost}`,
      );
      console.log(
        `ID tokens are verified by the Auth emulator at ${config.firebase.authEmulatorHost}`,
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
