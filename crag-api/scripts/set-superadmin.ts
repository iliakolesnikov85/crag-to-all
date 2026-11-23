import { existsSync } from 'fs';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { initializeFirebase, setSuperadminClaim } from '@crag-to-all/shared-firebase';

const envFiles = [
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../packages/shared-firebase/.env.local'),
  resolve(__dirname, '../../packages/shared-firebase/.env'),
];

for (const envFile of envFiles) {
  dotenv.config({ path: envFile });
}

function readArgs(argv: readonly string[]): { uid: string; keyPath: string } | null {
  const uid = argv[2]?.trim() ?? '';
  const keyPath = argv[3]?.trim() ?? '';
  if (argv.length !== 4 || !uid || /\s/.test(uid) || !keyPath) {
    return null;
  }
  return { uid, keyPath };
}

async function main(): Promise<void> {
  const args = readArgs(process.argv);
  if (!args) {
    console.error('Usage: npm run set-superadmin -- <uid> <service-account.json>');
    process.exitCode = 1;
    return;
  }
  const { uid, keyPath } = args;
  const keyFile = resolve(keyPath);
  if (!existsSync(keyFile)) {
    console.error(`Could not read the service account file (${keyFile}).`);
    process.exitCode = 1;
    return;
  }

  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (emulatorHost) {
    console.log(
      `Ignoring FIREBASE_AUTH_EMULATOR_HOST (${emulatorHost}). This script updates production Auth.`,
    );
  }

  delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH = keyFile;
  initializeFirebase(false);
  const { projectId } = await setSuperadminClaim(uid);
  console.log(
    `Set custom claim superadmin=true for ${uid} on ${projectId || '(unknown project)'}. Sign in again or call getIdToken(true) before the API sees it.`,
  );
}

main().catch((error: unknown) => {
  console.error('Failed to set the superadmin claim:', error);
  process.exitCode = 1;
});
