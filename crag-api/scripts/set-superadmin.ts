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

function readUid(argv: readonly string[]): string | null {
  const uid = argv[2]?.trim() ?? '';
  if (argv.length !== 3 || !uid || /\s/.test(uid)) {
    return null;
  }
  return uid;
}

async function main(): Promise<void> {
  const uid = readUid(process.argv);
  if (!uid) {
    console.error('Usage: npm run set-superadmin -- <uid>');
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
