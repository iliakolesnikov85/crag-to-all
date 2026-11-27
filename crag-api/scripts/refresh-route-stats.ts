import { connectMongo, readCloudConfig } from '@crag-to-all/shared-firebase';
import { refreshAllRouteStats } from '../src/store/crags';

function requireEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function main(): Promise<void> {
  if (!requireEnv('MONGODB_URI')) {
    console.error('Set MONGODB_URI to the Atlas connection string. This job does not use localhost.');
    process.exitCode = 1;
    return;
  }
  if (!requireEnv('MONGODB_DB')) {
    console.error('Set MONGODB_DB to the database name.');
    process.exitCode = 1;
    return;
  }

  let mongo;
  try {
    ({ mongo } = readCloudConfig({ firebaseUseEmulator: false }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`Route stats refresh stopped because the MongoDB settings are invalid: ${reason}`);
    process.exitCode = 1;
    return;
  }

  let client;
  try {
    client = await connectMongo(mongo);
  } catch (error) {
    console.error('Route stats refresh stopped because MongoDB did not connect:', error);
    process.exitCode = 1;
    return;
  }

  try {
    const updated = await refreshAllRouteStats(client.db(mongo.db));
    console.log(`Saved route stats for ${updated} crag(s) in ${mongo.db}.`);
  } catch (error) {
    console.error('Route stats refresh failed:', error);
    process.exitCode = 1;
  } finally {
    try {
      await client.close();
    } catch (error) {
      console.error('Failed to close MongoDB after the route stats refresh:', error);
    }
  }
}

main().catch((error: unknown) => {
  console.error('Route stats refresh stopped unexpectedly:', error);
  process.exitCode = 1;
});
