import { verifyFirebaseIdToken } from '@crag-to-all/shared-firebase';
import type { AuthCaller, IdTokenVerifier } from './types';

interface VerifiedIdTokenClaims {
  uid: string;
  email?: string;
  email_verified?: boolean;
  /** Custom claim. Only the JSON boolean `true` is a superadmin. */
  superadmin?: unknown;
}

export function toAuthCaller(decoded: VerifiedIdTokenClaims): AuthCaller {
  const email = typeof decoded.email === 'string' ? decoded.email.trim() : '';
  return {
    uid: decoded.uid,
    email: email.length > 0 ? email : null,
    emailVerified: decoded.email_verified === true,
    superadmin: decoded.superadmin === true,
  };
}

export function createFirebaseIdTokenVerifier(): IdTokenVerifier {
  return {
    async verifyIdToken(idToken) {
      return toAuthCaller(await verifyFirebaseIdToken(idToken));
    },
  };
}
