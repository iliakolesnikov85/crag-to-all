/**
 * Node 18 does not expose `globalThis.crypto` by default; vite-plugin-pwa's
 * service-worker build pulls in serialize-javascript which needs it at load time.
 */
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto as Crypto;
}
