import { readCloudConfig, type CloudConfig } from '@crag-to-all/shared-firebase';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_PORT = 3010;

function envPort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

export interface ApiConfig extends CloudConfig {
  port: number;
}

export function getConfig(): ApiConfig {
  return {
    port: envPort('PORT', DEFAULT_PORT),
    ...readCloudConfig({ firebaseUseEmulator: true }),
  };
}
