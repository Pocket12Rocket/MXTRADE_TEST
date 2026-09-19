import admin, { adminDb } from './firebaseAdmin';
import { UserFacingError } from './userMessage';
import { getBearerToken } from './server/request';

/**
 * Why: THE pattern for admin-gated API routes — verifies the caller's bearer ID token and looks
 * up `role === 'admin'` server-side via the Admin SDK (never trusts a client-supplied role
 * claim). The two rejection reasons are deliberate, safe-to-show sentences (wrapped as
 * `UserFacingError`, ARCH-14); a token verification failure from the Firebase Admin SDK itself
 * (expired/malformed token) is left as a plain `Error` so callers map it to a generic "not
 * authorized" sentence instead of forwarding raw Admin SDK error text.
 * @param {import('next').NextApiRequest} req - The incoming API request; reads the
 *   `Authorization: Bearer <token>` header.
 * @returns {Promise<import('firebase-admin/auth').DecodedIdToken>} The decoded token for the
 *   verified admin user.
 * @throws {UserFacingError} If the request has no bearer token, or the token's user isn't an
 *   admin.
 * @throws {Error} If `admin.auth().verifyIdToken()` itself rejects (e.g. expired/invalid token).
 * @example
 * const decoded = await requireAdminFromRequest(req);
 */
export async function requireAdminFromRequest(req) {
  const token = getBearerToken(req);
  if (!token) {
    throw new UserFacingError('Missing authorization token.');
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
    throw new UserFacingError('Admin privileges required.');
  }

  return decoded;
}
