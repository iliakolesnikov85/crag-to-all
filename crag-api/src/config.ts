import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_PORT = 3010;
const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DEFAULT_MONGODB_DB = 'crag-to-all';
const DEFAULT_FIREBASE_PROJECT_ID = 'crag-to-all';
const DEFAULT_FIREBASE_STORAGE_BUCKET = 'crag-to-all.firebasestorage.app';
const DEFAULT_FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

function envString(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function envPort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes') return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  throw new Error(`${name} must be a boolean`);
}

export interface ApiConfig {
  port: number;
  mongodbUri: string;
  mongodbDb: string;
  firebaseUseEmulator: boolean;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseStorageEmulatorHost: string;
}

export function getConfig(): ApiConfig {
  return {
    port: envPort('PORT', DEFAULT_PORT),
    mongodbUri: envString('MONGODB_URI', DEFAULT_MONGODB_URI),
    mongodbDb: envString('MONGODB_DB', DEFAULT_MONGODB_DB),
    firebaseUseEmulator: envBool('FIREBASE_USE_EMULATOR', true),
    firebaseProjectId: envString('FIREBASE_PROJECT_ID', DEFAULT_FIREBASE_PROJECT_ID),
    firebaseStorageBucket: envString('FIREBASE_STORAGE_BUCKET', DEFAULT_FIREBASE_STORAGE_BUCKET),
    firebaseStorageEmulatorHost: envString(
      'FIREBASE_STORAGE_EMULATOR_HOST',
      DEFAULT_FIREBASE_STORAGE_EMULATOR_HOST,
    ),
  };
}
